from __future__ import annotations

import json
import os
import re
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph


class PermissionState(MessagesState):
    """State accepted by Agent Chat UI.

    The frontend sends the current visual model in ``context.permission_design``.
    """

    context: dict[str, Any] | None


MODEL_NAME = os.getenv("MODEL", "openai:gpt-5.5")
_model = None

# Max conversation turns to keep (to prevent context dilution)
MAX_HISTORY_TURNS = 6


def _get_model():
    """Lazy-load the chat model to avoid initialization at import time."""
    global _model
    if _model is None:
        _model = init_chat_model(MODEL_NAME, streaming=False)
    return _model


# ---------------------------------------------------------------------------
# Intent extraction helpers
# ---------------------------------------------------------------------------

# Common aliases / synonyms for models – map user phrases to model IDs.
# Sorted longest-first so "customer invoice" matches before "customer".
MODEL_ALIASES: list[tuple[str, str]] = sorted(
    [
        ("delivery order", "picking"),
        ("delivery orders", "picking"),
        ("deliver order", "picking"),
        ("deliver orders", "picking"),
        ("stock.picking", "picking"),
        ("pickings", "picking"),
        ("picking", "picking"),
        ("delivery", "picking"),
        ("sales orders", "sale_order"),
        ("sales order", "sale_order"),
        ("sale orders", "sale_order"),
        ("sale order", "sale_order"),
        ("sale.order", "sale_order"),
        ("customer invoices", "invoice"),
        ("customer invoice", "invoice"),
        ("account.move", "invoice"),
        ("invoices", "invoice"),
        ("invoice", "invoice"),
        ("res.partner", "partner"),
        ("partners", "partner"),
        ("partner", "partner"),
        ("customers", "partner"),
        ("customer", "partner"),
    ],
    key=lambda x: len(x[0]),
    reverse=True,
)

# Common role aliases / synonyms for matching user input to role IDs.
ROLE_ALIASES: dict[str, str] = {
    "sales manager": "manager",
    "销售经理": "manager",
    "销售总监": "manager",
    "manager": "manager",
    "sales person": "sales",
    "salesperson": "sales",
    "销售": "sales",
    "销售员": "sales",
    "warehouse staff": "warehouse",
    "warehouse": "warehouse",
    "仓库": "warehouse",
    "仓库管理员": "warehouse",
    "accountant": "finance",
    "finance": "finance",
    "财务": "finance",
    "财务人员": "finance",
}


def _get_project(design: dict[str, Any]) -> dict[str, Any]:
    """Extract the project object from the permission_design context."""
    return design.get("project", {})


# Keys to strip from project data when sending to the model (UI-only data)
_UI_ONLY_KEYS = {"x", "y", "width", "height", "layout"}
# Keys to strip from field definitions (UI-only data)
_FIELD_UI_KEYS = {"x", "y", "width", "height", "layout", "visible", "collapsed"}


def _strip_ui_keys(obj: Any) -> Any:
    """Recursively strip UI-only keys from the design JSON to reduce token count."""
    if isinstance(obj, dict):
        return {
            k: _strip_ui_keys(v)
            for k, v in obj.items()
            if k not in _UI_ONLY_KEYS
        }
    if isinstance(obj, list):
        return [_strip_ui_keys(item) for item in obj]
    return obj


def _compress_design_for_model(design: dict[str, Any]) -> dict[str, Any]:
    """Create a compact version of the design for the model prompt.

    Strategy:
    - Always include full model list (id/name/technicalName only) so the model
      knows ALL available models — never truncate this.
    - Only expand full field details for the currently selected model.
    - Include roles list.
    - Strip all UI layout data (x, y, width, height, etc.).
    """
    project = design.get("project", {})
    selected_model_id = design.get("selectedModelId", "")

    # Build a compact model list (id + name + technicalName only)
    compact_models = []
    for m in project.get("models", []):
        compact_models.append({
            "id": m.get("id", ""),
            "name": m.get("name", ""),
            "technicalName": m.get("technicalName", ""),
        })

    # Find the selected model and include its full field details
    selected_model_detail = None
    for m in project.get("models", []):
        if m.get("id") == selected_model_id:
            # Strip UI keys from the selected model's fields
            selected_model_detail = _strip_ui_keys(m)
            break

    # Build compact roles list
    compact_roles = []
    for r in project.get("roles", []):
        compact_roles.append({
            "id": r.get("id", ""),
            "name": r.get("name", ""),
        })

    return {
        "project": {
            "models": compact_models,
            "roles": compact_roles,
        },
        "selectedModel": selected_model_detail,
        "selectedModelId": selected_model_id,
        "selectedRoleId": design.get("selectedRoleId", ""),
    }


def _build_model_display(project: dict[str, Any]) -> dict[str, str]:
    """Build a mapping from model id -> human-readable display string."""
    display: dict[str, str] = {}
    for m in project.get("models", []):
        mid = m.get("id", "")
        parts = [m.get("name", ""), m.get("technicalName", "")]
        display[mid] = " / ".join(p for p in parts if p) or mid
    return display


def _extract_target_model(
    user_text: str, project: dict[str, Any]
) -> dict[str, str] | None:
    """Try to identify which model the user is referring to."""
    text_lower = user_text.lower()
    models = project.get("models", [])
    display_map = _build_model_display(project)

    # 0. Exact word-boundary match on model name/ID (highest priority)
    #    e.g. "Users模型" -> must match model with name "Users" or id "users"
    #    Uses word boundary \b to avoid substring false matches
    for m in models:
        mid = m.get("id", "")
        name = m.get("name", "")
        tech = m.get("technicalName", "")
        # Check exact model name with word boundary
        if name and re.search(rf"\b{re.escape(name.lower())}\b", text_lower):
            return {"id": mid, "display": display_map.get(mid, mid)}
        # Check exact model ID with word boundary
        if mid and re.search(rf"\b{re.escape(mid.lower())}\b", text_lower):
            return {"id": mid, "display": display_map.get(mid, mid)}
        # Check technical name with word boundary
        if tech and re.search(rf"\b{re.escape(tech.lower())}\b", text_lower):
            return {"id": mid, "display": display_map.get(mid, mid)}

    # 1. Match by model ID (exact token match with word boundary)
    for m in models:
        mid = m.get("id", "")
        if re.search(rf"\b{re.escape(mid)}\b", text_lower):
            return {"id": mid, "display": display_map.get(mid, mid)}

    # 2. Match by model name / technicalName — sort by name length descending
    sorted_models = sorted(
        models,
        key=lambda m: max(len(m.get("name", "")), len(m.get("technicalName", ""))),
        reverse=True,
    )
    for m in sorted_models:
        name = m.get("name", "").lower()
        tech = m.get("technicalName", "").lower()
        if name and name in text_lower:
            return {"id": m["id"], "display": display_map.get(m["id"], m["id"])}
        if tech and tech in text_lower:
            return {"id": m["id"], "display": display_map.get(m["id"], m["id"])}

    # 3. Match by aliases (already sorted longest-first)
    for phrase, mid in MODEL_ALIASES:
        if phrase in text_lower:
            model_exists = any(m.get("id") == mid for m in models)
            if model_exists:
                return {"id": mid, "display": display_map.get(mid, mid)}

    return None


def _extract_target_role(
    user_text: str, project: dict[str, Any]
) -> dict[str, str] | None:
    """Try to identify which role the user is referring to."""
    text_lower = user_text.lower()
    roles = project.get("roles", [])

    id_to_role = {r["id"]: r for r in roles}
    valid_ids = {r["id"] for r in roles}

    candidates: list[tuple[int, str, dict[str, str]]] = []

    for r in roles:
        rid = r.get("id", "")
        name = r.get("name", "").lower()

        # Exact ID match with word boundary (quality 100)
        if re.search(rf"\b{re.escape(rid)}\b", text_lower):
            candidates.append((100, rid, {"id": rid, "name": r.get("name", rid)}))

        # Full name match (longest name = highest quality)
        if name and name in text_lower:
            candidates.append((90 + len(name), rid, {"id": rid, "name": r.get("name", rid)}))

    # Alias match — sort by length descending
    sorted_aliases = sorted(ROLE_ALIASES.items(), key=lambda x: len(x[0]), reverse=True)
    for alias, rid in sorted_aliases:
        if alias in text_lower and rid in valid_ids:
            candidates.append((80 + len(alias), rid, {"id": rid, "name": id_to_role[rid].get("name", rid)}))

    # Partial name words (lower priority, exclude ambiguous "sales")
    for r in roles:
        rid = r.get("id", "")
        name = r.get("name", "").lower()
        if name and len(name) > 3:
            words = [w for w in name.split() if len(w) > 2]
            for word in words:
                if word in text_lower and word not in ("sales",):
                    candidates.append((50, rid, {"id": rid, "name": r.get("name", rid)}))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][2]


def _extract_operations(user_text: str) -> list[str]:
    """Extract which CRUD operations the user is requesting."""
    text_lower = user_text.lower()
    ops: list[str] = []
    op_map = {
        "read": ["read", "可读", "读取", "读", "view", "read-only", "readonly", "查看"],
        "create": ["create", "创建", "新增", "add", "新建", "建立"],
        "write": ["write", "写入", "编辑", "modify", "修改", "edit", "写", "更改"],
        "unlink": ["unlink", "delete", "删除", "remove", "移除", "删"],
    }
    for op, keywords in op_map.items():
        if any(kw in text_lower for kw in keywords):
            ops.append(op)
    return ops


def extract_intent(
    user_text: str, design: dict[str, Any]
) -> dict[str, Any]:
    """Extract structured intent from user message.

    Priority: selectedModelId from UI > text-based extraction.
    """
    project = _get_project(design)
    display_map = _build_model_display(project)

    # 1. Check selectedModelId first — strongest signal
    selected_model_id = design.get("selectedModelId")
    target_model = None
    if selected_model_id:
        model_exists = any(m.get("id") == selected_model_id for m in project.get("models", []))
        if model_exists:
            target_model = {
                "id": selected_model_id,
                "display": display_map.get(selected_model_id, selected_model_id),
            }

    # 2. Fall back to text-based extraction
    if not target_model:
        target_model = _extract_target_model(user_text, project)

    target_role = _extract_target_role(user_text, project)
    operations = _extract_operations(user_text)

    return {
        "target_model": target_model,
        "target_role": target_role,
        "operations": operations,
        "raw_text": user_text,
    }


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """
You are an Odoo security architect embedded in a visual permission designer.
The current visual design is supplied as JSON after this instruction.

Your responsibilities:
1. Explain Odoo ACL, record-rule, field-security and workflow implications.
2. Convert the user's requested change into deterministic frontend operations.
3. Never claim that UI hiding alone is backend security.
4. Preserve existing permissions unless the user explicitly requests a change.
5. Resolve model and field identifiers from the supplied design, not from guesses.

When the user requests a change to the visual design, end your response with exactly
one fenced block in this format:

```permission_patch
{
  "summary": "Brief summary of the applied change",
  "operations": [
    {
      "op": "set_model_access",
      "roleId": "sales",
      "modelId": "sale_order",
      "operation": "write",
      "value": false
    }
  ]
}
```

CRITICAL: Use the exact "id" values from the CURRENT VISUAL DESIGN JSON above.
- roleId must match a role "id". When the user refers to a role by its Chinese name (e.g. "销售总监"), find the role whose "name" field equals that Chinese name, and use its "id".
- modelId must match a model "id" (e.g. "partner", "sale_order", "invoice", "picking"), NOT the technicalName like "stock.picking" or the Chinese name.
- fieldId must match a field "id" within that model.
- transitionId must match a workflow transition "id".
- If the user mentions a role/model/field that does not exist in the CURRENT VISUAL DESIGN, explain that it is missing and do NOT emit a permission_patch.

Supported operations:
- set_model_access(roleId, modelId, operation: read|create|write|unlink, value)
- set_field_access(roleId, modelId, fieldId, value: hidden|readonly|editable|masked)
- set_record_scope(roleId, modelId, value)
- set_transition_roles(transitionId, roleIds)
- set_transition_condition(transitionId, value)
- move_model(modelId, x, y)

For questions that do not request a visual change, do not emit a permission_patch.
Respond in the same language the user writes in: if the user writes in English, reply in English; if the user writes in Chinese, reply in Chinese.
""".strip()

INTENT_ANCHOR_PROMPT = """
CRITICAL — CURRENT REQUEST ANCHOR (DO NOT IGNORE):
You are being asked to modify a SPECIFIC model. Strictly follow these anchors:
{TARGET_BLOCK}

If the anchor says "No target model detected", use your best judgment but be extra careful to match the correct model from the design.
""".strip()


def _build_intent_anchor(intent: dict[str, Any]) -> str:
    """Build a strong anchor block to inject into the prompt."""
    lines: list[str] = []

    tm = intent.get("target_model")
    if tm:
        lines.append(f"  TARGET MODEL ID: {tm['id']}")
        lines.append(f"  TARGET MODEL NAME: {tm.get('display', 'N/A')}")
    else:
        lines.append("  TARGET MODEL: No target model detected yet — parse the user's latest message carefully.")

    tr = intent.get("target_role")
    if tr:
        lines.append(f"  TARGET ROLE ID: {tr['id']}")
        lines.append(f"  TARGET ROLE NAME: {tr.get('name', 'N/A')}")

    ops = intent.get("operations", [])
    if ops:
        lines.append(f"  REQUESTED OPERATIONS: {', '.join(ops)}")

    lines.append(
        "  INSTRUCTION: Your permission_patch MUST only operate on the TARGET MODEL ID above. "
        "NEVER substitute a different model (e.g. do NOT use 'sale_order' when the target is 'picking'). "
        "Double-check every modelId in your output against the TARGET MODEL ID."
    )

    return INTENT_ANCHOR_PROMPT.format(
        TARGET_BLOCK="\n".join(lines)
    )


# ---------------------------------------------------------------------------
# Patch extraction & validation
# ---------------------------------------------------------------------------

def _extract_permission_patch(text: str) -> dict[str, Any] | None:
    """Extract the JSON from a ```permission_patch fenced block.

    Uses balanced-brace matching to correctly handle nested JSON objects.
    """
    fence = "```permission_patch"
    start_idx = text.find(fence)
    if start_idx == -1:
        return None

    brace_start = text.find("{", start_idx)
    if brace_start == -1:
        return None

    depth = 0
    in_string = False
    escape_next = False
    for i in range(brace_start, len(text)):
        ch = text[i]
        if escape_next:
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                json_str = text[brace_start : i + 1]
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    return None

    return None


def _remove_permission_patch(text: str) -> str:
    """Remove the ```permission_patch fenced block from text."""
    fence = "```permission_patch"
    start_idx = text.find(fence)
    if start_idx == -1:
        return text

    brace_start = text.find("{", start_idx)
    if brace_start == -1:
        return text[:start_idx].rstrip()

    depth = 0
    in_string = False
    escape_next = False
    for i in range(brace_start, len(text)):
        ch = text[i]
        if escape_next:
            escape_next = False
            continue
        if ch == "\\":
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end_idx = i + 1
                remaining = text[end_idx:].lstrip()
                if remaining.startswith("```"):
                    end_idx = text.find("```", end_idx) + 3
                result = text[:start_idx].rstrip() + text[end_idx:]
                return result.strip()

    return text[:start_idx].strip()


def validate_patch(
    patch: dict[str, Any], intent: dict[str, Any], project: dict[str, Any]
) -> list[str]:
    """Validate that the patch matches the user's intent."""
    errors: list[str] = []
    tm = intent.get("target_model")

    if not tm:
        return errors

    target_id = tm["id"]
    valid_model_ids = {m["id"] for m in project.get("models", [])}

    for op in patch.get("operations", []):
        op_model_id = op.get("modelId", "")
        if op_model_id and op_model_id != target_id:
            errors.append(
                f"MODEL MISMATCH: operation targets '{op_model_id}' but the user requested "
                f"'{target_id}' ({tm.get('display', '')}). This is likely a confusion between "
                f"similar-sounding models. Please correct."
            )
        if op_model_id and op_model_id not in valid_model_ids:
            errors.append(
                f"INVALID MODEL ID: '{op_model_id}' does not exist in the current design."
            )

    return errors


# ---------------------------------------------------------------------------
# History management
# ---------------------------------------------------------------------------

def _truncate_history(messages: list[BaseMessage], max_turns: int) -> list[BaseMessage]:
    """Truncate conversation history to the last N user-assistant turns."""
    if len(messages) <= max_turns * 2:
        return messages

    result: list[BaseMessage] = []
    for i, msg in enumerate(messages):
        if isinstance(msg, SystemMessage) and i == 0:
            result.append(msg)

    non_system = [m for m in messages if not isinstance(m, SystemMessage)]
    kept = non_system[-(max_turns * 2):]
    result.extend(kept)
    return result


# ---------------------------------------------------------------------------
# Single graph node (simplified — no separate intent_router node)
# ---------------------------------------------------------------------------

def permission_assistant(state: PermissionState) -> dict[str, list[BaseMessage]]:
    context = state.get("context") or {}
    design = context.get("permission_design") or {}
    project = _get_project(design)
    messages = state.get("messages", [])

    # --- Inline intent extraction ---
    latest_text = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            latest_text = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    intent = extract_intent(latest_text, design) if latest_text else {}

    # --- Build system prompt with intent anchor ---
    intent_anchor = _build_intent_anchor(intent) if intent else ""
    # Compress design JSON to fit within model context window (strip UI layout data)
    compressed_design = _compress_design_for_model(design)
    design_json = json.dumps(compressed_design, ensure_ascii=False, indent=2)

    # Safety: if still too large, truncate to fit ~4000 chars (~1000 tokens)
    MAX_DESIGN_CHARS = 4000
    if len(design_json) > MAX_DESIGN_CHARS:
        design_json = design_json[:MAX_DESIGN_CHARS] + "\n...(truncated for length)"

    system_content = (
        SYSTEM_PROMPT
        + "\n\n"
        + intent_anchor
        + "\n\nCURRENT VISUAL DESIGN:\n"
        + design_json
    )
    context_message = SystemMessage(content=system_content)

    # Truncate history to prevent context dilution
    messages = _truncate_history(messages, MAX_HISTORY_TURNS)

    # Call model
    chat_model = _get_model()
    response = chat_model.invoke([context_message, *messages])
    if isinstance(response, str):
        response = AIMessage(content=response)

    # --- Output validation (no retry, to keep response fast for local models) ---
    patch_text = response.content if isinstance(response.content, str) else ""
    patch = _extract_permission_patch(patch_text)

    if patch and intent:
        tm = intent.get("target_model")
        if tm:
            target_id = tm["id"]
            # Auto-fix: correct modelId in all operations to match user's intent
            fixed_ops: list[str] = []
            for op in patch.get("operations", []):
                op_model = op.get("modelId", "")
                if op_model and op_model != target_id:
                    fixed_ops.append(f"{op_model} -> {target_id}")
                    op["modelId"] = target_id

            if fixed_ops:
                # Rebuild the patch text with corrected modelId
                corrected_patch_text = "```permission_patch\n" + json.dumps(patch, ensure_ascii=False, indent=2) + "\n```"
                current_content = response.content if isinstance(response.content, str) else str(response.content)
                cleaned_content = _remove_permission_patch(current_content)
                fixes = "\n".join(f"  - {f}" for f in fixed_ops)
                note = (
                    "️ **已自动修正**: 模型生成的补丁目标模型有误，已自动修正为正确的模型。\n"
                    f"- 用户请求的模型: {tm.get('id', 'unknown')} ({tm.get('display', '')})\n"
                    f"- 修正内容:\n{fixes}\n\n"
                    "---\n\n"
                )
                response = AIMessage(content=note + cleaned_content + "\n\n" + corrected_patch_text)

    return {"messages": [response]}


# ---------------------------------------------------------------------------
# Build the graph (single node, same as original)
# ---------------------------------------------------------------------------

builder = StateGraph(PermissionState)
builder.add_node("permission_assistant", permission_assistant)
builder.add_edge(START, "permission_assistant")
builder.add_edge("permission_assistant", END)
graph = builder.compile()

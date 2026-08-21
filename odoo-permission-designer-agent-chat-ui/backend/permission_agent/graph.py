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

    # Strategy: find model names that appear right before model indicators
    # like "模型", "model", "表". This avoids false matches from field names.
    # e.g., "sales order模型的customer字段" → "sales order" is before "模型"
    model_indicators = ["模型", "model", "表"]

    # Build a list of (model, position_before_indicator, match_length) candidates
    candidates: list[tuple[int, int, dict[str, str]]] = []
    for m in models:
        mid = m.get("id", "")
        name = m.get("name", "").lower()
        tech = m.get("technicalName", "").lower()

        for search_name in [name, tech, mid]:
            if not search_name:
                continue
            idx = text_lower.find(search_name)
            while idx != -1:
                after_idx = idx + len(search_name)
                remainder = text_lower[after_idx:]
                # Check if a model indicator follows immediately (with optional space)
                for indicator in model_indicators:
                    if remainder.lstrip().startswith(indicator):
                        candidates.append((len(search_name), idx, {"id": mid, "display": display_map.get(mid, mid)}))
                        break
                idx = text_lower.find(search_name, idx + 1)

    if candidates:
        # Pick the longest match at the earliest position
        candidates.sort(key=lambda x: (-x[0], x[1]))
        return candidates[0][2]

    # Fallback: alias matching (longest first)
    for phrase, mid in MODEL_ALIASES:
        if phrase in text_lower:
            model_exists = any(m.get("id") == mid for m in models)
            if model_exists:
                return {"id": mid, "display": display_map.get(mid, mid)}

    return None


def _extract_target_roles(
    user_text: str, project: dict[str, Any]
) -> list[dict[str, str]]:
    """Try to identify ALL roles the user is referring to (supports multiple roles)."""
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
        return []

    candidates.sort(key=lambda x: x[0], reverse=True)
    # Deduplicate by role id, keep highest quality
    seen: set[str] = set()
    result = []
    for _, rid, info in candidates:
        if rid not in seen:
            seen.add(rid)
            result.append(info)
    return result


def _extract_operations(user_text: str) -> list[str]:
    """Extract which CRUD operations the user is requesting."""
    text_lower = user_text.lower()
    ops: list[str] = []
    op_map = {
        "read": ["read", "可读", "读取", "读", "view", "read-only", "readonly", "查看", "只读"],
        "create": ["create", "创建", "新增", "add", "新建", "建立"],
        "write": ["write", "写入", "编辑", "modify", "修改", "edit", "写", "更改", "可编辑", "editable"],
        "unlink": ["unlink", "delete", "删除", "remove", "移除", "删"],
    }
    for op, keywords in op_map.items():
        if any(kw in text_lower for kw in keywords):
            ops.append(op)
    return ops


def _extract_target_fields(
    user_text: str, project: dict[str, Any], target_model_id: str | None
) -> list[dict[str, str]]:
    """Extract which fields the user is referring to within a specific model."""
    text_lower = user_text.lower()
    fields: list[dict[str, str]] = []

    if not target_model_id:
        return fields

    # Find the target model
    target_model = None
    for m in project.get("models", []):
        if m.get("id") == target_model_id:
            target_model = m
            break
    if not target_model:
        return fields

    # Extract the part after the model name to focus on field names only.
    # This prevents model name words from being mistaken as field names.
    # e.g., "customer Invoice模型里面的customer字段" → field_context = "customer字段"
    field_context = text_lower
    # Find model name in text and take everything after it
    model_name = target_model.get("name", "").lower()
    model_tech = target_model.get("technicalName", "").lower()
    for name in [model_name, model_tech]:
        if name and name in text_lower:
            idx = text_lower.index(name) + len(name)
            # Skip past common connectors like "模型", "的", "里面的"
            remainder = text_lower[idx:]
            skip_patterns = [
                r"^模型里面的", r"^模型中的", r"^模型的", r"^模型", r"^的", r"^里面的",
                r"^model's\s*", r"^model\s+", r"^'s\s*", r"^of\s+", r"^in\s+",
            ]
            for sp in skip_patterns:
                m2 = re.match(sp, remainder)
                if m2:
                    remainder = remainder[m2.end():]
                    break
            field_context = remainder
            break

    # Match field names (longest first to avoid partial matches)
    model_fields = target_model.get("fields", [])
    sorted_fields = sorted(model_fields, key=lambda f: len(f.get("name", "")), reverse=True)

    for f in sorted_fields:
        fname = f.get("name", "").lower()
        ftech = f.get("technicalName", "").lower()
        fid = f.get("id", "")

        if not fname and not ftech:
            continue

        # Use simple substring match within the field_context (after model name)
        # No \b needed since we already isolated the field portion
        matched = False
        if fname and fname in field_context:
            matched = True
        if not matched and ftech and ftech in field_context:
            matched = True

        if matched:
            fields.append({"id": fid, "name": f.get("name", ""), "technicalName": f.get("technicalName", "")})

    return fields


def _extract_field_access_level(user_text: str) -> str | None:
    """Extract the desired field access level: readonly, editable, hidden, masked."""
    text_lower = user_text.lower()

    # Check in priority order (more specific first)
    if any(kw in text_lower for kw in ["隐藏", "hidden", "不可见"]):
        return "hidden"
    if any(kw in text_lower for kw in ["掩码", "masked", "脱敏"]):
        return "masked"
    if any(kw in text_lower for kw in ["可编辑", "editable", "编辑", "修改", "写入", "write"]):
        return "editable"
    if any(kw in text_lower for kw in ["只读", "readonly", "read-only", "可读", "读取", "read"]):
        return "readonly"

    return None


def _extract_per_field_access_levels(
    user_text: str, target_fields: list[dict[str, str]]
) -> dict[str, str] | None:
    """Extract per-field access levels when different fields have different levels.

    e.g., "Customer字段改成readonly和Payment Status字段改成Editable"
    Returns: {"customer": "readonly", "payment status": "editable"}
    Returns None if all fields share the same level (use _extract_field_access_level instead).
    """
    if len(target_fields) <= 1:
        return None

    text_lower = user_text.lower()
    field_levels: dict[str, str] = {}

    # Patterns: "字段A改成X和字段B改成Y" or "字段A改成X，字段B改成Y"
    # Split by "和" or "，" or "," to find per-field segments
    segments = re.split(r'和|，|,', text_lower)

    for segment in segments:
        seg_lower = segment.strip().lower()
        # Determine access level for this segment
        level = None
        if any(kw in seg_lower for kw in ["隐藏", "hidden", "不可见"]):
            level = "hidden"
        elif any(kw in seg_lower for kw in ["掩码", "masked", "脱敏"]):
            level = "masked"
        elif any(kw in seg_lower for kw in ["可编辑", "editable", "编辑", "修改", "写入", "write"]):
            level = "editable"
        elif any(kw in seg_lower for kw in ["只读", "readonly", "read-only", "可读", "读取", "read"]):
            level = "readonly"

        if level:
            # Find which fields are mentioned in this segment
            for f in target_fields:
                fname = f.get("name", "").lower()
                ftech = f.get("technicalName", "").lower()
                if fname and fname in seg_lower:
                    field_levels[fname] = level
                elif ftech and ftech in seg_lower:
                    field_levels[ftech] = level

    # Only return if we found different levels for different fields
    if len(field_levels) > 1 and len(set(field_levels.values())) > 1:
        return field_levels

    return None


def _extract_target_all_models(user_text: str) -> bool:
    """Check if the user is requesting operations on ALL models."""
    text_lower = user_text.lower()
    all_model_keywords = [
        "全部模型", "所有模型", "全部表", "所有表",
        "all models", "every model", "all tables",
    ]
    return any(kw in text_lower for kw in all_model_keywords)


def _split_multi_sentence_requests(user_text: str) -> list[str]:
    """Split user text into separate requests if it contains multiple sentences.

    Detects patterns like:
    - "取消角色A对全部模型的权限。取消角色B对全部模型的权限。"
    - "授予X权限。授予Y权限。"
    - "授予A对B的权限，授予C对D的权限。"
    - "将A模型字段改成X，B模型字段改成Y。" (different models in one sentence)
    """
    # First, try to parse as JSON array (frontend may send structured messages)
    # e.g., "[{'type': 'text', 'text': '...'}]"
    user_text = user_text.strip()
    if user_text.startswith('[') and user_text.endswith(']'):
        try:
            import ast
            parsed = ast.literal_eval(user_text)
            if isinstance(parsed, list) and len(parsed) == 1 and isinstance(parsed[0], dict):
                # Extract text from single message object
                user_text = parsed[0].get('text', user_text)
        except Exception:
            pass

    # Split by Chinese period, Chinese comma, English period, comma, or newline
    sentences = re.split(r'[。.,，\n]+', user_text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if len(sentences) <= 1:
        return [user_text]

    # Action keywords that indicate a new permission request
    action_keywords = ["授予", "取消", "移除", "grant", "revoke", "deny", "remove", "allow", "禁止", "将"]
    multi_request_sentences = []
    for s in sentences:
        s_lower = s.lower()
        if any(kw in s_lower for kw in action_keywords):
            multi_request_sentences.append(s)

    # If we found multiple action-related sentences, return them separately
    if len(multi_request_sentences) > 1:
        return multi_request_sentences

    # Also detect model-switching patterns within a single sentence.
    # e.g., "Customer Invoice里的X字段改成Editable，Customer里面的Y字段改成Editable"
    # The second clause starts with a model name followed by "里面的" or "里的" or "模型"
    model_switch_pattern = re.compile(
        r'(?:里面的|里的|模型里面的|模型中的|模型的|model\'s|model\s+in|of\s+)',
        re.IGNORECASE
    )
    # Re-split and check if any clause (without action keyword) contains a model switch
    has_model_switch = False
    for s in sentences:
        if not any(kw in s.lower() for kw in action_keywords):
            if model_switch_pattern.search(s):
                has_model_switch = True
                break

    if has_model_switch and len(sentences) > 1:
        # Return all non-empty clauses as separate requests
        return sentences

    return [user_text]


def extract_intent(
    user_text: str, design: dict[str, Any]
) -> dict[str, Any]:
    """Extract structured intent from user message.

    Priority: text-based extraction > selectedModelId from UI.
    When the user explicitly mentions a model in their text, use that.
    Only fall back to UI selected model when text doesn't mention any model.
    """
    project = _get_project(design)
    display_map = _build_model_display(project)

    # Detect "all models" request
    target_all_models = _extract_target_all_models(user_text)

    # 1. Text-based extraction first — user's explicit mention is strongest signal
    target_model = _extract_target_model(user_text, project)

    # 2. Fall back to UI selectedModelId only if text doesn't mention any model
    if not target_model and not target_all_models:
        selected_model_id = design.get("selectedModelId")
        if selected_model_id:
            model_exists = any(m.get("id") == selected_model_id for m in project.get("models", []))
            if model_exists:
                target_model = {
                    "id": selected_model_id,
                    "display": display_map.get(selected_model_id, selected_model_id),
                }

    target_roles = _extract_target_roles(user_text, project)
    operations = _extract_operations(user_text)

    # Extract field-level information
    target_model_id = target_model["id"] if target_model else None

    # Check for "所有字段" (all fields) pattern
    text_lower = user_text.lower()
    all_fields_keywords = ["所有字段", "全部字段", "all fields", "every field"]
    is_all_fields = any(kw in text_lower for kw in all_fields_keywords)

    if is_all_fields:
        # Expand to all fields of all relevant models
        all_target_fields = []
        if target_all_models:
            # All models + all fields
            for m in project.get("models", []):
                for f in m.get("fields", []):
                    all_target_fields.append({
                        "id": f.get("id"),
                        "name": f.get("name"),
                        "technicalName": f.get("technicalName"),
                        "_model_id": m.get("id"),
                    })
        elif target_model_id:
            # Specific model + all fields
            target_model_obj = next((m for m in project.get("models", []) if m.get("id") == target_model_id), None)
            if target_model_obj:
                for f in target_model_obj.get("fields", []):
                    all_target_fields.append({
                        "id": f.get("id"),
                        "name": f.get("name"),
                        "technicalName": f.get("technicalName"),
                        "_model_id": target_model_id,
                    })
        target_fields = all_target_fields
    else:
        target_fields = _extract_target_fields(user_text, project, target_model_id)

    field_access_level = _extract_field_access_level(user_text)

    # Check for per-field access levels (e.g., "Customer改成readonly和Payment Status改成Editable")
    per_field_levels = _extract_per_field_access_levels(user_text, target_fields) if target_fields and not is_all_fields else None

    return {
        "target_model": target_model,
        "target_all_models": target_all_models,
        "target_roles": target_roles,
        "operations": operations,
        "target_fields": target_fields,
        "field_access_level": field_access_level,
        "per_field_levels": per_field_levels,
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
    target_all_models = intent.get("target_all_models", False)
    if tm:
        lines.append(f"  TARGET MODEL ID: {tm['id']}")
        lines.append(f"  TARGET MODEL NAME: {tm.get('display', 'N/A')}")
    elif target_all_models:
        lines.append("  TARGET: ALL MODELS — generate operations for EVERY model in the design.")
    else:
        lines.append("  TARGET MODEL: No target model detected yet — parse the user's latest message carefully.")

    target_roles = intent.get("target_roles", [])
    if target_roles:
        role_ids = ", ".join(r["id"] for r in target_roles)
        role_names = ", ".join(r.get("name", r["id"]) for r in target_roles)
        lines.append(f"  TARGET ROLE IDs: {role_ids}")
        lines.append(f"  TARGET ROLE NAMES: {role_names}")
        lines.append("  INSTRUCTION: Generate operations for ALL target roles listed above.")
    else:
        lines.append("  TARGET ROLE: No target role detected yet — parse the user's latest message carefully.")

    ops = intent.get("operations", [])
    if ops:
        lines.append(f"  REQUESTED OPERATIONS: {', '.join(ops)}")

    if tm and not target_all_models:
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

def _build_patch_from_intent(intent: dict[str, Any], project: dict[str, Any]) -> dict[str, Any] | None:
    """Build a complete permission patch directly from intent, bypassing model generation.

    Used when the intent is clear enough (specific roles, models, operations) that
    we can deterministically generate the patch without relying on the model.
    """
    target_roles = intent.get("target_roles", [])
    target_model = intent.get("target_model")
    target_all_models = intent.get("target_all_models", False)
    operations = intent.get("operations", [])
    target_fields = intent.get("target_fields", [])
    field_access_level = intent.get("field_access_level")
    per_field_levels = intent.get("per_field_levels")

    if not target_roles:
        return None

    # Determine which models to operate on
    if target_all_models:
        model_ids = [m["id"] for m in project.get("models", [])]
    elif target_model:
        model_ids = [target_model["id"]]
    else:
        return None

    # Determine the value: "取消" means false, "授予" means true
    text_lower = intent.get("raw_text", "").lower()
    is_cancel = any(kw in text_lower for kw in ["取消", "移除", "remove", "revoke", "deny", "禁止"])
    value = not is_cancel

    ops: list[dict[str, Any]] = []

    # Handle field-level permissions if fields are specified
    if target_fields and per_field_levels:
        # Per-field access levels (different fields have different levels)
        for role in target_roles:
            for field in target_fields:
                fname = field.get("name", "").lower()
                ftech = field.get("technicalName", "").lower()
                field_level = per_field_levels.get(fname) or per_field_levels.get(ftech) or field_access_level
                if not field_level:
                    continue
                # Use field's _model_id if present (for all-models case), otherwise use model_ids
                field_model_ids = [field["_model_id"]] if field.get("_model_id") else model_ids
                for model_id in field_model_ids:
                    ops.append({
                        "op": "set_field_access",
                        "roleId": role["id"],
                        "modelId": model_id,
                        "fieldId": field["id"],
                        "value": field_level,
                    })
        field_names = ", ".join(f["name"] for f in target_fields)
        action_desc = f"Set {field_names} field(s) with per-field levels"
    elif target_fields and field_access_level:
        for role in target_roles:
            for field in target_fields:
                field_model_ids = [field["_model_id"]] if field.get("_model_id") else model_ids
                for model_id in field_model_ids:
                    ops.append({
                        "op": "set_field_access",
                        "roleId": role["id"],
                        "modelId": model_id,
                        "fieldId": field["id"],
                        "value": field_access_level,
                    })
        field_names = ", ".join(f["name"] for f in target_fields)
        action_desc = f"Set {field_names} field(s) to {field_access_level}"
    elif operations:
        # Handle model-level permissions
        for role in target_roles:
            for model_id in model_ids:
                for op_name in operations:
                    ops.append({
                        "op": "set_model_access",
                        "roleId": role["id"],
                        "modelId": model_id,
                        "operation": op_name,
                        "value": value,
                    })
        action = "Revoke" if is_cancel else "Grant"
        action_desc = f"{action} {', '.join(operations)} permission(s)"
    else:
        return None

    role_names = ", ".join(r.get("name", r["id"]) for r in target_roles)
    if target_all_models:
        model_desc = "all models"
    else:
        model_desc = target_model.get("display", target_model["id"]) if target_model else "unknown"

    return {
        "summary": f"{action_desc} for {role_names} on {model_desc}",
        "operations": ops,
    }


def _process_single_request(
    sentence: str,
    design: dict[str, Any],
    project: dict[str, Any],
    history_messages: list[BaseMessage],
    compressed_design_json: str,
) -> tuple[str, dict[str, Any] | None]:
    """Process a single sentence request and return (response_text, patch)."""
    intent = extract_intent(sentence, design) if sentence else {}

    # Try to build patch directly from intent (deterministic, no model needed)
    direct_patch = _build_patch_from_intent(intent, project)

    # Still call model for text explanation
    intent_anchor = _build_intent_anchor(intent) if intent else ""
    system_content = (
        SYSTEM_PROMPT
        + "\n\n"
        + intent_anchor
        + "\n\nCURRENT VISUAL DESIGN:\n"
        + compressed_design_json
    )
    context_message = SystemMessage(content=system_content)

    chat_model = _get_model()
    response = chat_model.invoke([context_message, *history_messages])
    if isinstance(response, str):
        response_text = response
    else:
        response_text = response.content if isinstance(response.content, str) else str(response.content)

    # Filter out model refusal responses (local models sometimes output these)
    refusal_patterns = [
        "对不起，我无法",
        "抱歉，我无法",
        "I cannot continue",
        "I'm unable to",
        "I apologize",
        "I'm sorry",
        "I can't help",
        "I cannot help",
        "I cannot complete",
        "I'm not able to",
        "在当前",
    ]
    for pattern in refusal_patterns:
        if pattern in response_text:
            response_text = ""
            break

    # Use direct patch if available, otherwise try to extract from model response
    if direct_patch:
        patch = direct_patch
    else:
        patch = _extract_permission_patch(response_text)
        # Auto-fix modelId mismatches
        if patch and intent:
            tm = intent.get("target_model")
            if tm:
                target_id = tm["id"]
                for op in patch.get("operations", []):
                    op_model = op.get("modelId", "")
                    if op_model and op_model != target_id:
                        op["modelId"] = target_id

    return response_text, patch


def permission_assistant(state: PermissionState) -> dict[str, list[BaseMessage]]:
    context = state.get("context") or {}
    design = context.get("permission_design") or {}
    project = _get_project(design)
    messages = state.get("messages", [])

    # --- Get latest user text ---
    latest_text = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            latest_text = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    # --- Split multi-sentence requests ---
    sentences = _split_multi_sentence_requests(latest_text) if latest_text else [latest_text]

    # --- Compress design JSON once ---
    compressed_design = _compress_design_for_model(design)
    design_json = json.dumps(compressed_design, ensure_ascii=False, indent=2)
    MAX_DESIGN_CHARS = 4000
    if len(design_json) > MAX_DESIGN_CHARS:
        design_json = design_json[:MAX_DESIGN_CHARS] + "\n...(truncated for length)"

    # Truncate history
    history_messages = _truncate_history(messages, MAX_HISTORY_TURNS)

    # --- Process each sentence separately ---
    all_patches: list[dict[str, Any]] = []
    all_responses: list[str] = []
    auto_fix_notes: list[str] = []

    for sentence in sentences:
        response_text, patch = _process_single_request(
            sentence, design, project, history_messages, design_json
        )
        all_responses.append(response_text)
        if patch:
            all_patches.append(patch)

    # --- Merge all patches into one ---
    if all_patches:
        merged_operations: list[dict[str, Any]] = []
        seen_ops: set[tuple] = set()
        for p in all_patches:
            for op in p.get("operations", []):
                op_key = (op.get("op"), op.get("roleId"), op.get("modelId"), op.get("fieldId"), op.get("operation"), op.get("value"))
                if op_key not in seen_ops:
                    seen_ops.add(op_key)
                    merged_operations.append(op)

        merged_patch = {
            "summary": f"Merged patch from {len(sentences)} request(s)",
            "operations": merged_operations,
        }

        # Build final response
        if len(sentences) > 1:
            summary_parts = []
            for i, sentence in enumerate(sentences):
                summary_parts.append(f"请求 {i+1}: {sentence}")
            header = "️ **多请求处理**: 检测到多个独立请求，已分别处理并合并。\n\n" + "\n".join(f"- {s}" for s in summary_parts) + "\n\n---\n\n"
        else:
            header = ""

        merged_patch_text = "```permission_patch\n" + json.dumps(merged_patch, ensure_ascii=False, indent=2) + "\n```"
        # Use the last response's text content (without its patch) as the explanation
        last_response = all_responses[-1] if all_responses else ""
        last_cleaned = _remove_permission_patch(last_response)
        final_content = header + last_cleaned + "\n\n" + merged_patch_text
        response = AIMessage(content=final_content)
    else:
        # No patches generated, just return the last response
        response = AIMessage(content=all_responses[-1] if all_responses else "")

    return {"messages": [response]}


# ---------------------------------------------------------------------------
# Build the graph (single node, same as original)
# ---------------------------------------------------------------------------

builder = StateGraph(PermissionState)
builder.add_node("permission_assistant", permission_assistant)
builder.add_edge(START, "permission_assistant")
builder.add_edge("permission_assistant", END)
graph = builder.compile()

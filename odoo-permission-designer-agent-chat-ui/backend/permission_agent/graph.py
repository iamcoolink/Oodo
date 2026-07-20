from __future__ import annotations

import json
import os
from typing import Any

from langchain.chat_models import init_chat_model
from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph


class PermissionState(MessagesState):
    """State accepted by Agent Chat UI.

    The frontend sends the current visual model in ``context.permission_design``.
    """

    context: dict[str, Any] | None


MODEL_NAME = os.getenv("MODEL", "openai:gpt-5.5")
model = init_chat_model(MODEL_NAME)

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
  "summary": "Chinese summary of the applied change",
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

Supported operations:
- set_model_access(roleId, modelId, operation: read|create|write|unlink, value)
- set_field_access(roleId, modelId, fieldId, value: hidden|readonly|editable|masked)
- set_record_scope(roleId, modelId, value)
- set_transition_roles(transitionId, roleIds)
- set_transition_condition(transitionId, value)
- move_model(modelId, x, y)

For questions that do not request a visual change, do not emit a permission_patch.
Return concise Chinese unless the user uses another language.
""".strip()


def permission_assistant(state: PermissionState) -> dict[str, list[BaseMessage]]:
    context = state.get("context") or {}
    design = context.get("permission_design") or {}
    context_message = SystemMessage(
        content=(
            SYSTEM_PROMPT
            + "\n\nCURRENT VISUAL DESIGN:\n"
            + json.dumps(design, ensure_ascii=False, indent=2)
        )
    )
    response = model.invoke([context_message, *state["messages"]])
    return {"messages": [response]}


builder = StateGraph(PermissionState)
builder.add_node("permission_assistant", permission_assistant)
builder.add_edge(START, "permission_assistant")
builder.add_edge("permission_assistant", END)
graph = builder.compile()

import type {
  PermissionPatch,
  PermissionPatchOperation,
  PermissionProject,
  ValidationFinding,
} from "./types";

export function applyPermissionPatch(
  project: PermissionProject,
  patch: PermissionPatch,
): PermissionProject {
  return patch.operations.reduce(applyOperation, project);
}

function applyOperation(
  project: PermissionProject,
  operation: PermissionPatchOperation,
): PermissionProject {
  switch (operation.op) {
    case "set_model_access":
      return {
        ...project,
        models: project.models.map((model) =>
          model.id !== operation.modelId
            ? model
            : {
                ...model,
                accessByRole: {
                  ...model.accessByRole,
                  [operation.roleId]: {
                    ...model.accessByRole[operation.roleId],
                    [operation.operation]: operation.value,
                  },
                },
              },
        ),
      };
    case "set_field_access":
      return {
        ...project,
        models: project.models.map((model) =>
          model.id !== operation.modelId
            ? model
            : {
                ...model,
                fields: model.fields.map((field) =>
                  field.id !== operation.fieldId
                    ? field
                    : {
                        ...field,
                        accessByRole: {
                          ...field.accessByRole,
                          [operation.roleId]: operation.value,
                        },
                      },
                ),
              },
        ),
      };
    case "set_record_scope":
      return {
        ...project,
        models: project.models.map((model) =>
          model.id !== operation.modelId
            ? model
            : {
                ...model,
                recordScopeByRole: {
                  ...model.recordScopeByRole,
                  [operation.roleId]: operation.value,
                },
              },
        ),
      };
    case "set_transition_roles":
      return {
        ...project,
        workflow: {
          ...project.workflow,
          transitions: project.workflow.transitions.map((transition) =>
            transition.id === operation.transitionId
              ? { ...transition, allowedRoleIds: operation.roleIds }
              : transition,
          ),
        },
      };
    case "set_transition_condition":
      return {
        ...project,
        workflow: {
          ...project.workflow,
          transitions: project.workflow.transitions.map((transition) =>
            transition.id === operation.transitionId
              ? { ...transition, condition: operation.value }
              : transition,
          ),
        },
      };
    case "move_model":
      return {
        ...project,
        models: project.models.map((model) =>
          model.id === operation.modelId
            ? { ...model, position: { x: operation.x, y: operation.y } }
            : model,
        ),
      };
    default:
      return project;
  }
}

export function parsePermissionPatch(content: unknown): PermissionPatch | null {
  const text = messageContentToText(content);
  const fenced = text.match(/```permission_patch\s*([\s\S]*?)```/i);
  const tagged = text.match(/<permission_patch>([\s\S]*?)<\/permission_patch>/i);
  const raw = fenced?.[1] ?? tagged?.[1];
  if (!raw) return null;

  try {
    const candidate = JSON.parse(raw.trim()) as PermissionPatch;
    if (!candidate || !Array.isArray(candidate.operations)) return null;
    return candidate;
  } catch {
    return null;
  }
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (typeof block === "string") return block;
      if (!block || typeof block !== "object") return "";
      const record = block as Record<string, unknown>;
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      return "";
    })
    .join("\n");
}

export function validateProject(project: PermissionProject): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const model of project.models) {
    for (const role of project.roles) {
      const access = model.accessByRole[role.id];
      if (!access) continue;

      if ((access.create || access.write || access.unlink) && !access.read) {
        findings.push({
          id: `${model.id}-${role.id}-write-without-read`,
          severity: "error",
          title: `${role.name} 对 ${model.name} 的 ACL 不一致`,
          detail: "创建、修改或删除权限已开启，但读取权限未开启。",
        });
      }

      if (access.unlink && role.id === "sales") {
        findings.push({
          id: `${model.id}-${role.id}-unlink`,
          severity: "warning",
          title: `${role.name} 可以删除 ${model.name}`,
          detail: "基础业务用户通常不应拥有删除核心业务记录的权限。",
        });
      }

      for (const field of model.fields) {
        const fieldAccess = field.accessByRole[role.id];
        if (fieldAccess === "editable" && !access.write) {
          findings.push({
            id: `${model.id}-${field.id}-${role.id}-editable`,
            severity: "warning",
            title: `${field.name} 显示为可编辑，但模型不可写`,
            detail: `${role.name} 没有 ${model.technicalName} 的 write ACL。`,
          });
        }
      }
    }
  }

  for (const transition of project.workflow.transitions) {
    if (transition.allowedRoleIds.length === 0) {
      findings.push({
        id: `${transition.id}-no-role`,
        severity: "error",
        title: `${transition.name} 没有执行角色`,
        detail: "流程将无法从当前状态继续。",
      });
    }
    if (!transition.condition.trim()) {
      findings.push({
        id: `${transition.id}-no-condition`,
        severity: "info",
        title: `${transition.name} 未定义前置条件`,
        detail: "请确认该转换是否确实可以无条件执行。",
      });
    }
  }

  return findings;
}

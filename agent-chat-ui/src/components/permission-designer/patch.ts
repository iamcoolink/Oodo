import type {
  PermissionPatch,
  PermissionPatchOperation,
  PermissionProject,
  ValidationFinding,
} from "./types";

export interface PatchApplyResult {
  project: PermissionProject;
  skipped: string[];
}

export function applyPermissionPatch(
  project: PermissionProject,
  patch: PermissionPatch,
  t: (key: string, ...args: any[]) => string,
): PatchApplyResult {
  const skipped: string[] = [];
  const nextProject = patch.operations.reduce<PermissionProject>(
    (current, operation) => applyOperation(current, operation, skipped, t),
    project,
  );
  return { project: nextProject, skipped };
}

function resolveRoleId(project: PermissionProject, roleId: string): string | null {
  if (project.roles.some((role) => role.id === roleId)) return roleId;
  const byName = project.roles.find(
    (role) => role.name === roleId || role.technicalName === roleId,
  );
  return byName?.id ?? null;
}

function resolveModelId(project: PermissionProject, modelId: string): string | null {
  if (project.models.some((model) => model.id === modelId)) return modelId;
  const byName = project.models.find(
    (model) => model.name === modelId || model.technicalName === modelId,
  );
  return byName?.id ?? null;
}

function resolveFieldId(
  model: { fields: { id: string; name: string; technicalName: string }[] },
  fieldId: string,
): string | null {
  if (model.fields.some((field) => field.id === fieldId)) return fieldId;
  const byName = model.fields.find(
    (field) => field.name === fieldId || field.technicalName === fieldId,
  );
  return byName?.id ?? null;
}

function applyOperation(
  project: PermissionProject,
  operation: PermissionPatchOperation,
  skipped: string[],
  t: (key: string, ...args: any[]) => string,
): PermissionProject {
  switch (operation.op) {
    case "set_model_access": {
      const roleId = resolveRoleId(project, operation.roleId);
      const modelId = resolveModelId(project, operation.modelId);
      if (!roleId || !modelId) {
        skipped.push(
          t("errors.modelNotFound", operation.op, operation.roleId, operation.modelId),
        );
        return project;
      }
      return {
        ...project,
        models: project.models.map((model) =>
          model.id !== modelId
            ? model
            : {
                ...model,
                accessByRole: {
                  ...model.accessByRole,
                  [roleId]: {
                    ...model.accessByRole[roleId],
                    [operation.operation]: operation.value,
                  },
                },
              },
        ),
      };
    }
    case "set_field_access": {
      const roleId = resolveRoleId(project, operation.roleId);
      const modelId = resolveModelId(project, operation.modelId);
      if (!roleId || !modelId) {
        skipped.push(
          t("errors.modelNotFound", operation.op, operation.roleId, operation.modelId),
        );
        return project;
      }
      const model = project.models.find((m) => m.id === modelId);
      const fieldId = model ? resolveFieldId(model, operation.fieldId) : null;
      if (!fieldId) {
        skipped.push(t("errors.fieldNotFound", operation.op, operation.fieldId));
        return project;
      }
      return {
        ...project,
        models: project.models.map((modelItem) =>
          modelItem.id !== modelId
            ? modelItem
            : {
                ...modelItem,
                fields: modelItem.fields.map((field) =>
                  field.id !== fieldId
                    ? field
                    : {
                        ...field,
                        accessByRole: {
                          ...field.accessByRole,
                          [roleId]: operation.value,
                        },
                      },
                ),
              },
        ),
      };
    }
    case "set_record_scope": {
      const roleId = resolveRoleId(project, operation.roleId);
      const modelId = resolveModelId(project, operation.modelId);
      if (!roleId || !modelId) {
        skipped.push(
          t("errors.modelNotFound", operation.op, operation.roleId, operation.modelId),
        );
        return project;
      }
      return {
        ...project,
        models: project.models.map((model) =>
          model.id !== modelId
            ? model
            : {
                ...model,
                recordScopeByRole: {
                  ...model.recordScopeByRole,
                  [roleId]: operation.value,
                },
              },
        ),
      };
    }
    case "set_transition_roles": {
      const transition = project.workflow.transitions.find(
        (transitionItem) =>
          transitionItem.id === operation.transitionId ||
          transitionItem.name === operation.transitionId,
      );
      if (!transition) {
        skipped.push(t("errors.transitionNotFound", operation.op, operation.transitionId));
        return project;
      }
      const resolvedRoleIds = operation.roleIds
        .map((roleId) => resolveRoleId(project, roleId))
        .filter((roleId): roleId is string => roleId !== null);
      return {
        ...project,
        workflow: {
          ...project.workflow,
          transitions: project.workflow.transitions.map((transitionItem) =>
            transitionItem.id === transition.id
              ? { ...transitionItem, allowedRoleIds: resolvedRoleIds }
              : transitionItem,
          ),
        },
      };
    }
    case "set_transition_condition": {
      const transition = project.workflow.transitions.find(
        (transitionItem) =>
          transitionItem.id === operation.transitionId ||
          transitionItem.name === operation.transitionId,
      );
      if (!transition) {
        skipped.push(t("errors.transitionNotFound", operation.op, operation.transitionId));
        return project;
      }
      return {
        ...project,
        workflow: {
          ...project.workflow,
          transitions: project.workflow.transitions.map((transitionItem) =>
            transitionItem.id === transition.id
              ? { ...transitionItem, condition: operation.value }
              : transitionItem,
          ),
        },
      };
    }
    case "move_model": {
      const modelId = resolveModelId(project, operation.modelId);
      if (!modelId) {
        skipped.push(t("errors.modelNotFound", operation.op, "", operation.modelId));
        return project;
      }
      return {
        ...project,
        models: project.models.map((model) =>
          model.id === modelId
            ? { ...model, position: { x: operation.x, y: operation.y } }
            : model,
        ),
      };
    }
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

export function validateProject(
  project: PermissionProject,
  t: (key: string, ...args: any[]) => string,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const model of project.models) {
    for (const role of project.roles) {
      const access = model.accessByRole[role.id];
      if (!access) continue;

      if ((access.create || access.write || access.unlink) && !access.read) {
        findings.push({
          id: `${model.id}-${role.id}-write-without-read`,
          severity: "error",
          title: t("errors.aclInconsistent", role.name, model.name),
          detail: t("errors.aclInconsistentDetail"),
        });
      }

      if (access.unlink && role.id === "sales") {
        findings.push({
          id: `${model.id}-${role.id}-unlink`,
          severity: "warning",
          title: t("errors.canDelete", role.name, model.name),
          detail: t("errors.canDeleteDetail"),
        });
      }

      for (const field of model.fields) {
        const fieldAccess = field.accessByRole[role.id];
        if (fieldAccess === "editable" && !access.write) {
          findings.push({
            id: `${model.id}-${field.id}-${role.id}-editable`,
            severity: "warning",
            title: t("errors.editableButNotWritable", field.name),
            detail: t("errors.editableButNotWritableDetail", role.name, model.technicalName),
          });
        }
      }
    }
  }

  return findings;
}

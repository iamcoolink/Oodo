import type {
  PermissionProject,
  RoleDefinition,
  UserDefinition,
  ModelDefinition,
  FieldDefinition,
  AccessRights,
  FieldAccess,
} from "./types";

const DEFAULT_ROLE: RoleDefinition = {
  id: "default_user",
  name: "默认用户",
  technicalName: "group_default_user",
};

const DEFAULT_USER: UserDefinition = {
  id: "admin",
  name: "管理员",
  email: "admin@example.com",
  company: "Default Company",
  roleIds: [DEFAULT_ROLE.id],
};

const DEFAULT_ACCESS_RIGHTS: AccessRights = {
  read: true,
  create: false,
  write: false,
  unlink: false,
};

const DEFAULT_FIELD_ACCESS: FieldAccess = "readonly";

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function isTableOnlyFormat(data: unknown): data is Record<string, unknown> & { tables: unknown[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "tables" in data &&
    Array.isArray((data as { tables: unknown[] }).tables)
  );
}

function isPermissionProject(data: unknown): data is PermissionProject {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "roles" in data &&
    Array.isArray((data as PermissionProject).roles) &&
    "models" in data &&
    Array.isArray((data as PermissionProject).models)
  );
}

function convertTableToModel(
  table: unknown,
  index: number,
  roleIds: string[],
): ModelDefinition {
  const t = table as Record<string, unknown>;

  const technicalName =
    (t.technicalName as string) ||
    (t.tableName as string) ||
    (t.name as string) ||
    `table_${index}`;

  const displayName =
    (t.name as string) || technicalName || `表 ${index + 1}`;

  const modelId = generateId(technicalName);

  const accessByRole: Record<string, AccessRights> = {};
  const recordScopeByRole: Record<string, string> = {};
  roleIds.forEach((roleId) => {
    accessByRole[roleId] = { ...DEFAULT_ACCESS_RIGHTS };
    recordScopeByRole[roleId] = "[(1, '=', 1)]";
  });

  const fields: FieldDefinition[] = [];
  const rawFields = t.fields;
  if (Array.isArray(rawFields)) {
    rawFields.forEach((f, fieldIndex) => {
      const field = f as Record<string, unknown>;
      const fieldTechnicalName =
        (field.technicalName as string) ||
        (field.name as string) ||
        `field_${fieldIndex}`;

      const fieldDisplayName =
        (field.name as string) || fieldTechnicalName || `字段 ${fieldIndex + 1}`;

      const accessByRole: Record<string, FieldAccess> = {};
      roleIds.forEach((roleId) => {
        accessByRole[roleId] = DEFAULT_FIELD_ACCESS;
      });

      fields.push({
        id: generateId(`${modelId}_${fieldTechnicalName}`),
        name: fieldDisplayName,
        technicalName: fieldTechnicalName,
        fieldType: (field.type as string) || (field.fieldType as string) || "char",
        relation: (field.relation as string) || undefined,
        accessByRole,
      });
    });
  }

  const col = index % 3;
  const row = Math.floor(index / 3);

  return {
    id: modelId,
    name: displayName,
    technicalName,
    module: (t.module as string) || "Base",
    position: {
      x: 250 + col * 260,
      y: 50 + row * 280,
    },
    accessByRole,
    recordScopeByRole,
    fields,
  };
}

export function normalizePermissionProject(data: unknown): PermissionProject {
  if (isPermissionProject(data)) {
    const project = data;

    const roles = project.roles.length > 0 ? project.roles : [DEFAULT_ROLE];
    const roleIds = roles.map((r) => r.id);

    const users =
      project.users && project.users.length > 0
        ? project.users
        : [DEFAULT_USER];

    const models = project.models.map((model) => {
      const accessByRole: Record<string, AccessRights> = {};
      const recordScopeByRole: Record<string, string> = {};

      roleIds.forEach((roleId) => {
        accessByRole[roleId] = model.accessByRole?.[roleId] || {
          ...DEFAULT_ACCESS_RIGHTS,
        };
        recordScopeByRole[roleId] =
          model.recordScopeByRole?.[roleId] || "[(1, '=', 1)]";
      });

      const fields = model.fields.map((field) => {
        const accessByRole: Record<string, FieldAccess> = {};
        roleIds.forEach((roleId) => {
          accessByRole[roleId] =
            field.accessByRole?.[roleId] || DEFAULT_FIELD_ACCESS;
        });

        return {
          ...field,
          accessByRole,
        };
      });

      return {
        ...model,
        position: model.position || { x: 250, y: 50 },
        accessByRole,
        recordScopeByRole,
        fields,
      };
    });

    return {
      ...project,
      roles,
      users,
      models,
      workflow: project.workflow || {
        model: models[0]?.technicalName || "sale.order",
        states: [],
        transitions: [],
      },
    };
  }

  if (isTableOnlyFormat(data)) {
    const tables = data.tables as unknown[];
    const roles: RoleDefinition[] = [DEFAULT_ROLE];
    const roleIds = roles.map((r) => r.id);

    const models = tables.map((table, index) =>
      convertTableToModel(table, index, roleIds),
    );

    return {
      id: (data.id as string) || generateId((data.name as string) || "imported"),
      name: (data.name as string) || "导入的权限设计",
      odooVersion: (data.odooVersion as string) || "19.0",
      roles,
      users: [DEFAULT_USER],
      models,
      workflow: {
        model: models[0]?.technicalName || "sale.order",
        states: [],
        transitions: [],
      },
    };
  }

  throw new Error("无法识别的 JSON 格式");
}

export function addRoleToProject(
  project: PermissionProject,
  name: string,
  technicalName: string,
): PermissionProject {
  const id = generateId(technicalName);

  if (project.roles.some((r) => r.id === id)) {
    throw new Error(`角色 ${technicalName} 已存在`);
  }

  const newRole: RoleDefinition = { id, name, technicalName };

  const models = project.models.map((model) => {
    const accessByRole = { ...model.accessByRole };
    const recordScopeByRole = { ...model.recordScopeByRole };

    accessByRole[id] = { ...DEFAULT_ACCESS_RIGHTS };
    recordScopeByRole[id] = "[(1, '=', 1)]";

    const fields = model.fields.map((field) => ({
      ...field,
      accessByRole: {
        ...field.accessByRole,
        [id]: DEFAULT_FIELD_ACCESS,
      },
    }));

    return {
      ...model,
      accessByRole,
      recordScopeByRole,
      fields,
    };
  });

  return {
    ...project,
    roles: [...project.roles, newRole],
    models,
  };
}

export function deleteRoleFromProject(
  project: PermissionProject,
  roleId: string,
): PermissionProject {
  if (project.roles.length <= 1) {
    throw new Error("至少保留一个角色");
  }

  const roleExists = project.roles.some((r) => r.id === roleId);
  if (!roleExists) {
    throw new Error(`角色不存在`);
  }

  const roles = project.roles.filter((r) => r.id !== roleId);

  const users = project.users.map((user) => ({
    ...user,
    roleIds: user.roleIds.filter((id) => id !== roleId),
  }));

  const models = project.models.map((model) => {
    const accessByRole: Record<string, AccessRights> = {};
    const recordScopeByRole: Record<string, string> = {};

    Object.entries(model.accessByRole).forEach(([id, rights]) => {
      if (id !== roleId) accessByRole[id] = rights;
    });
    Object.entries(model.recordScopeByRole).forEach(([id, scope]) => {
      if (id !== roleId) recordScopeByRole[id] = scope;
    });

    const fields = model.fields.map((field) => {
      const accessByRole: Record<string, FieldAccess> = {};
      Object.entries(field.accessByRole).forEach(([id, access]) => {
        if (id !== roleId) accessByRole[id] = access;
      });
      return { ...field, accessByRole };
    });

    return {
      ...model,
      accessByRole,
      recordScopeByRole,
      fields,
    };
  });

  const transitions = project.workflow.transitions.map((transition) => ({
    ...transition,
    allowedRoleIds: transition.allowedRoleIds.filter((id) => id !== roleId),
  }));

  return {
    ...project,
    roles,
    users,
    models,
    workflow: {
      ...project.workflow,
      transitions,
    },
  };
}

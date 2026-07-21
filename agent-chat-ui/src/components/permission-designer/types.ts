export type CrudOperation = "read" | "create" | "write" | "unlink";
export type FieldAccess = "hidden" | "readonly" | "editable" | "masked";

export interface AccessRights {
  read: boolean;
  create: boolean;
  write: boolean;
  unlink: boolean;
}

export interface RoleDefinition {
  id: string;
  name: string;
  technicalName: string;
}

export interface UserDefinition {
  id: string;
  name: string;
  email: string;
  company: string;
  roleIds: string[];
}

export interface FieldDefinition {
  id: string;
  name: string;
  technicalName: string;
  fieldType: string;
  relation?: string;
  accessByRole: Record<string, FieldAccess>;
}

export interface ModelPosition {
  x: number;
  y: number;
}

export interface ModelDefinition {
  id: string;
  name: string;
  technicalName: string;
  module: string;
  position: ModelPosition;
  accessByRole: Record<string, AccessRights>;
  recordScopeByRole: Record<string, string>;
  fields: FieldDefinition[];
}

export interface WorkflowStateDefinition {
  id: string;
  name: string;
  technicalValue: string;
  x: number;
  y: number;
}

export interface WorkflowTransitionDefinition {
  id: string;
  name: string;
  from: string;
  to: string;
  allowedRoleIds: string[];
  condition: string;
  actions: string[];
}

export interface PermissionProject {
  id: string;
  name: string;
  odooVersion: string;
  roles: RoleDefinition[];
  users: UserDefinition[];
  models: ModelDefinition[];
  workflow: {
    model: string;
    states: WorkflowStateDefinition[];
    transitions: WorkflowTransitionDefinition[];
  };
}

export type PermissionPatchOperation =
  | {
      op: "set_model_access";
      roleId: string;
      modelId: string;
      operation: CrudOperation;
      value: boolean;
    }
  | {
      op: "set_field_access";
      roleId: string;
      modelId: string;
      fieldId: string;
      value: FieldAccess;
    }
  | {
      op: "set_record_scope";
      roleId: string;
      modelId: string;
      value: string;
    }
  | {
      op: "set_transition_roles";
      transitionId: string;
      roleIds: string[];
    }
  | {
      op: "set_transition_condition";
      transitionId: string;
      value: string;
    }
  | {
      op: "move_model";
      modelId: string;
      x: number;
      y: number;
    };

export interface PermissionPatch {
  summary?: string;
  operations: PermissionPatchOperation[];
}

export interface ValidationFinding {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
}

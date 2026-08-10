import type { TranslationDictionary } from "./types";

export const en: TranslationDictionary = {
  // page
  "page.title": "Odoo Permission & Workflow Designer",
  "page.subtitle": "Visual Odoo Permission Design Workbench",
  "page.loading": "Loading workspace…",
  "page.wideWindowTitle": "Permission canvas needs a wider window",
  "page.wideWindowMessage":
    "Please expand your browser window above 1280px. Chat remains available in the current window.",

  // thread
  "thread.headerTitle": "Odoo ERP",
  "thread.headerSubtitle": "Odoo Permission Design Assistant",
  "thread.online": "online",
  "thread.newThreadTooltip": "New thread",
  "thread.welcomeMessage":
    "Describe the Odoo diagram page you want to modify. I will analyze business rules and update the prototype on the right.",
  "thread.inputPlaceholder":
    "E.g., add two-level approval when amount exceeds 50,000...",
  "thread.sendHint": "Enter to send · Shift+Enter for new line",
  "thread.hideToolCalls": "Hide Tool Calls",

  // designer buttons
  "designer.buttons.check": "Check",
  "designer.buttons.exportJson": "Export JSON",
  "designer.buttons.importJson": "Import JSON",
  "designer.buttons.save": "Save",
  "designer.buttons.copy": "Copy",
  "designer.buttons.add": "+ Add",

  // designer tabs
  "designer.tabs.map": "Permission Map",
  "designer.tabs.matrix": "Field Matrix",
  "designer.tabs.workflow": "Workflow",
  "designer.tabs.code": "Odoo Code",

  // designer map
  "designer.map.title": "Role-Model-Field Effective Permissions",
  "designer.map.searchPlaceholder": "Search models or fields",
  "designer.map.rolesLabel": "Roles",
  "designer.map.deleteRoleTooltip": "Delete role",

  // designer inspector
  "designer.inspector.editing": (roleName: string) => `Editing: <strong>${roleName}</strong>`,
  "designer.inspector.modelAcl": "Model ACL",
  "designer.inspector.recordScope": "Record Scope",
  "designer.inspector.recordScopeHint":
    "This condition will generate <code>ir.rule.domain_force</code>. Validate in a real Odoo environment before going live.",
  "designer.inspector.fieldAccess": "Field Access",

  // designer matrix
  "designer.matrix.title": "Field Permission Matrix",
  "designer.matrix.subtitle":
    "Batch compare hidden, readonly, editable and masked states across roles.",
  "designer.matrix.modelColumn": "Model",
  "designer.matrix.fieldColumn": "Field",
  "designer.matrix.technicalNameColumn": "Technical Name",

  // designer workflow
  "designer.workflow.title": "Sales Order State Workflow",
  "designer.workflow.modelLabel": (model: string) => `Model: ${model}`,
  "designer.workflow.clickHint": "Click a transition line to configure roles",
  "designer.workflow.transitionLabel": "Transition",
  "designer.workflow.unknownState": "Unknown state",
  "designer.workflow.allowedRoles": "Allowed Roles",
  "designer.workflow.precondition": "Precondition",
  "designer.workflow.autoActions": "Auto Actions",
  "designer.workflow.emptyTitle": "No transitions",
  "designer.workflow.emptyHint": "Click a transition line on the left",

  // designer code
  "designer.code.title": "Odoo Security Code Generation",
  "designer.code.subtitle":
    "Generated code is an implementation draft; review against target module XML IDs.",
  "designer.code.tabs.acl": "ir.model.access.csv",
  "designer.code.tabs.rules": "security_rules.xml",
  "designer.code.tabs.fields": "Field Security Plan",

  // designer findings
  "designer.findings.title": "Permission Check Results",
  "designer.findings.count": (n: number) => `${n} findings`,
  "designer.findings.close": "Close",
  "designer.findings.empty": "No obvious permission conflicts found.",

  // designer footer / context
  "designer.simulateUser": "Simulate User",
  "designer.contextInfo":
    "Current permission design is sent as <code>permission_design</code> context to the left LangGraph Agent",
  "designer.counts.roles": (n: number) => `${n} roles`,
  "designer.counts.models": (n: number) => `${n} models`,
  "designer.counts.fields": (n: number) => `${n} fields`,

  // designer add role dialog
  "designer.addRole.title": "Add Role",
  "designer.addRole.nameLabel": "Role Name",
  "designer.addRole.namePlaceholder": "E.g., Sales Director",
  "designer.addRole.technicalLabel": "Technical Name",
  "designer.addRole.technicalPlaceholder": "E.g., group_sales_director",
  "designer.addRole.cancel": "Cancel",
  "designer.addRole.confirm": "Confirm",

  // designer toast messages
  "designer.toast.patchPartial": "Some permission changes were not applied",
  "designer.toast.patchSuccess": "Applied permission changes from chat",
  "designer.toast.patchSummary": (n: number) => `${n} changes applied.`,
  "designer.toast.saveSuccess": "Design saved",
  "designer.toast.saveSuccessDesc": "Design will be restored next time",
  "designer.toast.saveError": "Save failed",
  "designer.toast.saveErrorDesc": "Browser storage may be full",
  "designer.toast.importSuccess": "Permission design imported",
  "designer.toast.importSuccessDesc": (file: string, models: number, roles: number) =>
    `${file} (${models} models, ${roles} roles)`,
  "designer.toast.importError": "Import failed",
  "designer.toast.importErrorDesc": "Unable to parse JSON file",
  "designer.toast.addRoleError": "Please enter role name and technical name",
  "designer.toast.addRoleSuccess": "Role added",
  "designer.toast.deleteRoleError": "Keep at least one role",
  "designer.toast.deleteRoleSuccess": "Role deleted",
  "designer.toast.copySuccess": "Code copied",
  "designer.toast.genericError": "Unknown error",

  // field access labels
  "fieldAccess.hidden": "Hidden",
  "fieldAccess.readonly": "Readonly",
  "fieldAccess.editable": "Editable",
  "fieldAccess.masked": "Masked",

  // patch / validation errors
  "errors.unrecognizableJson": "Unrecognizable JSON format",
  "errors.roleExists": (name: string) => `Role ${name} already exists`,
  "errors.keepOneRole": "Keep at least one role",
  "errors.roleNotFound": "Role not found",
  "errors.modelNotFound": (op: string, roleId: string, modelId: string) =>
    `${op}: role "${roleId}" or model "${modelId}" not found`,
  "errors.fieldNotFound": (op: string, fieldId: string) =>
    `${op}: field "${fieldId}" not found`,
  "errors.transitionNotFound": (op: string, transitionId: string) =>
    `${op}: transition "${transitionId}" not found`,
  "errors.aclInconsistent": (roleName: string, modelName: string) =>
    `${roleName}'s ACL for ${modelName} is inconsistent`,
  "errors.aclInconsistentDetail":
    "Create, write or unlink permission is enabled but read permission is not.",
  "errors.canDelete": (roleName: string, modelName: string) =>
    `${roleName} can delete ${modelName}`,
  "errors.canDeleteDetail":
    "Basic business users should usually not have permission to delete core business records.",
  "errors.editableButNotWritable": (fieldName: string) =>
    `${fieldName} is editable but the model is not writable`,
  "errors.editableButNotWritableDetail": (roleName: string, modelTechnicalName: string) =>
    `${roleName} does not have write ACL for ${modelTechnicalName}.`,
  "errors.noRoleForTransition": (transitionName: string) =>
    `${transitionName} has no executing role`,
  "errors.noRoleForTransitionDetail": "The workflow will not be able to proceed from the current state.",
  "errors.noConditionForTransition": (transitionName: string) =>
    `${transitionName} has no precondition defined`,
  "errors.noConditionForTransitionDetail":
    "Please confirm whether this transition can indeed be executed unconditionally.",

  // utils defaults / fallbacks
  "utils.defaultRoleName": "Default User",
  "utils.defaultUserName": "Administrator",
  "utils.defaultProjectName": "Imported Permission Design",
  "utils.fallbackModelName": (index: number) => `Table ${index}`,
  "utils.fallbackFieldName": (index: number) => `Field ${index}`,
};

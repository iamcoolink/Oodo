import type { TranslationDictionary } from "./types";

export const zh: TranslationDictionary = {
  // page
  "page.title": "Odoo 权限与流程设计器",
  "page.subtitle": "可视化 Odoo 权限设计工作台",
  "page.loading": "正在加载工作区…",
  "page.wideWindowTitle": "权限设计画布需要更宽的窗口",
  "page.wideWindowMessage": "请将浏览器窗口扩展到 1280px 以上。聊天功能仍可在当前窗口使用。",

  // thread
  "thread.headerTitle": "Odoo ERP",
  "thread.headerSubtitle": "Odoo 权限设计助手",
  "thread.online": "online",
  "thread.newThreadTooltip": "New thread",
  "thread.welcomeMessage":
    "请描述需要修改的 Odoo 关系图页面，我会分析业务规则并同步更新右侧原型。",
  "thread.inputPlaceholder": "例如：金额超过5万元时增加两级审批......",
  "thread.sendHint": "Enter 发送 · Shift+Enter 换行",
  "thread.hideToolCalls": "Hide Tool Calls",

  // designer buttons
  "designer.buttons.check": "检查",
  "designer.buttons.exportJson": "导出 JSON",
  "designer.buttons.importJson": "导入 JSON",
  "designer.buttons.save": "保存",
  "designer.buttons.copy": "复制",
  "designer.buttons.add": "+ 添加",

  // designer tabs
  "designer.tabs.map": "权限关系图",
  "designer.tabs.matrix": "字段矩阵",
  "designer.tabs.workflow": "流程设计",
  "designer.tabs.code": "Odoo 代码",

  // designer map
  "designer.map.title": "角色—模型—字段有效权限图",
  "designer.map.searchPlaceholder": "搜索模型或字段",
  "designer.map.rolesLabel": "角色",
  "designer.map.deleteRoleTooltip": "删除角色",

  // designer inspector
  "designer.inspector.editing": (roleName: string) => `正在编辑：<strong>${roleName}</strong>`,
  "designer.inspector.modelAcl": "模型 ACL",
  "designer.inspector.recordScope": "记录范围",
  "designer.inspector.recordScopeHint":
    "该条件将生成 <code>ir.rule.domain_force</code>。上线前需在真实 Odoo 环境验证。",
  "designer.inspector.fieldAccess": "字段权限",

  // designer matrix
  "designer.matrix.title": "字段权限矩阵",
  "designer.matrix.subtitle":
    "批量比较各角色对字段的隐藏、只读、编辑与脱敏状态。",
  "designer.matrix.modelColumn": "模型",
  "designer.matrix.fieldColumn": "字段",
  "designer.matrix.technicalNameColumn": "技术名称",

  // designer workflow
  "designer.workflow.title": "销售订单状态流程",
  "designer.workflow.modelLabel": (model: string) => `模型：${model}`,
  "designer.workflow.clickHint": "点击连线配置执行角色",
  "designer.workflow.transitionLabel": "流程转换",
  "designer.workflow.unknownState": "未知状态",
  "designer.workflow.allowedRoles": "允许执行的角色",
  "designer.workflow.precondition": "前置条件",
  "designer.workflow.autoActions": "自动动作",
  "designer.workflow.emptyTitle": "暂无流程转换",
  "designer.workflow.emptyHint": "点击左侧连线选择一个转换",

  // designer code
  "designer.code.title": "Odoo 安全代码生成",
  "designer.code.subtitle":
    "生成结果是实施草案，仍需结合目标模块 XML ID 进行审核。",
  "designer.code.tabs.acl": "ir.model.access.csv",
  "designer.code.tabs.rules": "security_rules.xml",
  "designer.code.tabs.fields": "字段安全计划",

  // designer findings
  "designer.findings.title": "权限检查结果",
  "designer.findings.count": (n: number) => `${n} 项发现`,
  "designer.findings.close": "关闭",
  "designer.findings.empty": "未发现明显的权限配置冲突。",

  // designer footer / context
  "designer.simulateUser": "模拟用户",
  "designer.contextInfo":
    "当前权限设计已作为 <code>permission_design</code> 上下文发送给左侧 LangGraph Agent",
  "designer.counts.roles": (n: number) => `${n} 个角色`,
  "designer.counts.models": (n: number) => `${n} 个模型`,
  "designer.counts.fields": (n: number) => `${n} 个字段`,

  // designer add role dialog
  "designer.addRole.title": "添加角色",
  "designer.addRole.nameLabel": "角色名称",
  "designer.addRole.namePlaceholder": "例如：销售总监",
  "designer.addRole.technicalLabel": "技术名称",
  "designer.addRole.technicalPlaceholder": "例如：group_sales_director",
  "designer.addRole.cancel": "取消",
  "designer.addRole.confirm": "确认",

  // designer toast messages
  "designer.toast.patchPartial": "部分权限变更未生效",
  "designer.toast.patchSuccess": "已应用聊天中的权限变更",
  "designer.toast.patchSummary": (n: number) => `共执行 ${n} 项变更。`,
  "designer.toast.saveSuccess": "设计已保存",
  "designer.toast.saveSuccessDesc": "下次打开会自动恢复当前设计",
  "designer.toast.saveError": "保存失败",
  "designer.toast.saveErrorDesc": "浏览器存储空间可能已满",
  "designer.toast.importSuccess": "已导入权限设计",
  "designer.toast.importSuccessDesc": (file: string, models: number, roles: number) =>
    `${file}（${models} 个模型，${roles} 个角色）`,
  "designer.toast.importError": "导入失败",
  "designer.toast.importErrorDesc": "无法解析 JSON 文件",
  "designer.toast.addRoleError": "请填写角色名称和技术名称",
  "designer.toast.addRoleSuccess": "已添加角色",
  "designer.toast.deleteRoleError": "至少保留一个角色",
  "designer.toast.deleteRoleSuccess": "已删除角色",
  "designer.toast.copySuccess": "代码已复制",
  "designer.toast.genericError": "未知错误",

  // field access labels
  "fieldAccess.hidden": "隐藏",
  "fieldAccess.readonly": "只读",
  "fieldAccess.editable": "可编辑",
  "fieldAccess.masked": "脱敏",

  // patch / validation errors
  "errors.unrecognizableJson": "无法识别的 JSON 格式",
  "errors.roleExists": (name: string) => `角色 ${name} 已存在`,
  "errors.keepOneRole": "至少保留一个角色",
  "errors.roleNotFound": "角色不存在",
  "errors.modelNotFound": (op: string, roleId: string, modelId: string) =>
    `${op}: 未找到角色 "${roleId}" 或模型 "${modelId}"`,
  "errors.fieldNotFound": (op: string, fieldId: string) =>
    `${op}: 未找到字段 "${fieldId}"`,
  "errors.transitionNotFound": (op: string, transitionId: string) =>
    `${op}: 未找到转换 "${transitionId}"`,
  "errors.aclInconsistent": (roleName: string, modelName: string) =>
    `${roleName} 对 ${modelName} 的 ACL 不一致`,
  "errors.aclInconsistentDetail":
    "创建、修改或删除权限已开启，但读取权限未开启。",
  "errors.canDelete": (roleName: string, modelName: string) =>
    `${roleName} 可以删除 ${modelName}`,
  "errors.canDeleteDetail": "基础业务用户通常不应拥有删除核心业务记录的权限。",
  "errors.editableButNotWritable": (fieldName: string) =>
    `${fieldName} 显示为可编辑，但模型不可写`,
  "errors.editableButNotWritableDetail": (roleName: string, modelTechnicalName: string) =>
    `${roleName} 没有 ${modelTechnicalName} 的 write ACL。`,
  "errors.noRoleForTransition": (transitionName: string) =>
    `${transitionName} 没有执行角色`,
  "errors.noRoleForTransitionDetail": "流程将无法从当前状态继续。",
  "errors.noConditionForTransition": (transitionName: string) =>
    `${transitionName} 未定义前置条件`,
  "errors.noConditionForTransitionDetail": "请确认该转换是否确实可以无条件执行。",

  // utils defaults / fallbacks
  "utils.defaultRoleName": "默认用户",
  "utils.defaultUserName": "管理员",
  "utils.defaultProjectName": "导入的权限设计",
  "utils.fallbackModelName": (index: number) => `表 ${index}`,
  "utils.fallbackFieldName": (index: number) => `字段 ${index}`,
};

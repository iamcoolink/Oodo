import type { AccessRights, FieldAccess, PermissionProject } from "./types";

const crud = (
  read: boolean,
  create: boolean,
  write: boolean,
  unlink: boolean,
): AccessRights => ({ read, create, write, unlink });

const fieldAccess = (
  sales: FieldAccess,
  manager: FieldAccess,
  finance: FieldAccess,
  warehouse: FieldAccess,
): Record<string, FieldAccess> => ({ sales, manager, finance, warehouse });

export const initialPermissionProject: PermissionProject = {
  id: "odoo-access-studio-demo",
  name: "Odoo 销售订单权限设计",
  odooVersion: "19.0",
  roles: [
    { id: "sales", name: "销售人员", technicalName: "group_sale_user" },
    {
      id: "manager",
      name: "销售经理",
      technicalName: "group_sale_manager",
    },
    { id: "finance", name: "财务人员", technicalName: "group_account_user" },
    { id: "warehouse", name: "仓库人员", technicalName: "group_stock_user" },
  ],
  users: [
    {
      id: "john",
      name: "John Smith",
      email: "john@example.com",
      company: "US Company",
      roleIds: ["sales"],
    },
    {
      id: "sarah",
      name: "Sarah Miller",
      email: "sarah@example.com",
      company: "US Company",
      roleIds: ["manager"],
    },
    {
      id: "emma",
      name: "Emma Davis",
      email: "emma@example.com",
      company: "US Company",
      roleIds: ["finance"],
    },
  ],
  models: [
    {
      id: "partner",
      name: "客户",
      technicalName: "res.partner",
      module: "Contacts",
      position: { x: 270, y: 42 },
      accessByRole: {
        sales: crud(true, true, true, false),
        manager: crud(true, true, true, true),
        finance: crud(true, false, false, false),
        warehouse: crud(true, false, false, false),
      },
      recordScopeByRole: {
        sales: "['|', ('user_id', '=', user.id), ('create_uid', '=', user.id)]",
        manager: "[('team_id.member_ids', 'in', user.id)]",
        finance: "[(1, '=', 1)]",
        warehouse: "[('customer_rank', '>', 0)]",
      },
      fields: [
        {
          id: "partner_name",
          name: "客户名称",
          technicalName: "name",
          fieldType: "char",
          accessByRole: fieldAccess("editable", "editable", "readonly", "readonly"),
        },
        {
          id: "partner_phone",
          name: "电话",
          technicalName: "phone",
          fieldType: "char",
          accessByRole: fieldAccess("editable", "editable", "masked", "hidden"),
        },
        {
          id: "partner_credit",
          name: "信用额度",
          technicalName: "credit_limit",
          fieldType: "monetary",
          accessByRole: fieldAccess("hidden", "readonly", "editable", "hidden"),
        },
      ],
    },
    {
      id: "sale_order",
      name: "销售订单",
      technicalName: "sale.order",
      module: "Sales",
      position: { x: 530, y: 190 },
      accessByRole: {
        sales: crud(true, true, true, false),
        manager: crud(true, true, true, true),
        finance: crud(true, false, false, false),
        warehouse: crud(true, false, false, false),
      },
      recordScopeByRole: {
        sales: "[('user_id', '=', user.id)]",
        manager: "[('team_id.member_ids', 'in', user.id)]",
        finance: "[(1, '=', 1)]",
        warehouse: "[('state', 'in', ['sale', 'done'])]",
      },
      fields: [
        {
          id: "order_partner",
          name: "客户",
          technicalName: "partner_id",
          fieldType: "many2one",
          relation: "res.partner",
          accessByRole: fieldAccess("editable", "editable", "readonly", "readonly"),
        },
        {
          id: "order_amount",
          name: "销售金额",
          technicalName: "amount_total",
          fieldType: "monetary",
          accessByRole: fieldAccess("editable", "editable", "readonly", "readonly"),
        },
        {
          id: "order_margin",
          name: "毛利率",
          technicalName: "margin_percent",
          fieldType: "float",
          accessByRole: fieldAccess("hidden", "readonly", "readonly", "hidden"),
        },
        {
          id: "order_state",
          name: "状态",
          technicalName: "state",
          fieldType: "selection",
          accessByRole: fieldAccess("readonly", "readonly", "readonly", "readonly"),
        },
      ],
    },
    {
      id: "invoice",
      name: "客户发票",
      technicalName: "account.move",
      module: "Accounting",
      position: { x: 800, y: 48 },
      accessByRole: {
        sales: crud(true, false, false, false),
        manager: crud(true, false, false, false),
        finance: crud(true, true, true, true),
        warehouse: crud(false, false, false, false),
      },
      recordScopeByRole: {
        sales: "[('invoice_user_id', '=', user.id)]",
        manager: "[('invoice_user_id.team_id.member_ids', 'in', user.id)]",
        finance: "[('company_id', 'in', company_ids)]",
        warehouse: "[(0, '=', 1)]",
      },
      fields: [
        {
          id: "invoice_partner",
          name: "客户",
          technicalName: "partner_id",
          fieldType: "many2one",
          relation: "res.partner",
          accessByRole: fieldAccess("readonly", "readonly", "editable", "hidden"),
        },
        {
          id: "invoice_amount",
          name: "发票金额",
          technicalName: "amount_total",
          fieldType: "monetary",
          accessByRole: fieldAccess("readonly", "readonly", "editable", "hidden"),
        },
        {
          id: "invoice_payment",
          name: "付款状态",
          technicalName: "payment_state",
          fieldType: "selection",
          accessByRole: fieldAccess("readonly", "readonly", "editable", "hidden"),
        },
      ],
    },
  ],
};

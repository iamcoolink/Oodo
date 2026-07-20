# JSON 导入格式说明

本文档描述 Odoo 权限与流程设计器可导入的 JSON 文件结构。根据该文档设计表。最后输出相应json格式。

## 顶层结构

```json
{
  "id": "odoo-access-studio-demo",
  "name": "Odoo 销售订单权限设计",
  "odooVersion": "19.0",
  "roles": [],
  "users": [],
  "models": [],
  "workflow": {
    "model": "sale.order",
    "states": [],
    "transitions": []
  }
}
```

### 必填字段

导入时系统会校验以下字段，缺少任意一个都会报错：

- `id`：项目的唯一标识
- `roles`：必须是数组
- `models`：必须是数组

## roles（角色定义）

```json
[
  {
    "id": "sales",
    "name": "销售人员",
    "technicalName": "group_sale_user"
  },
  {
    "id": "manager",
    "name": "销售经理",
    "technicalName": "group_sale_manager",
    "inherits": ["sales"]
  }
]
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 角色唯一标识，后续会被引用 |
| `name` | string | 是 | 界面显示名称 |
| `technicalName` | string | 是 | Odoo 中的 group 技术名称或 XML ID |
| `inherits` | string[] | 否 | 继承的角色 id 列表 |

## users（模拟用户）

```json
[
  {
    "id": "john",
    "name": "John Smith",
    "email": "john@example.com",
    "company": "US Company",
    "roleIds": ["sales"]
  }
]
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 用户唯一标识 |
| `name` | string | 是 | 用户名 |
| `email` | string | 是 | 邮箱 |
| `company` | string | 是 | 所属公司 |
| `roleIds` | string[] | 是 | 关联的角色 id 列表，对应 `roles` 中的 `id` |

## models（模型定义）

```json
[
  {
    "id": "sale_order",
    "name": "销售订单",
    "technicalName": "sale.order",
    "module": "Sales",
    "position": { "x": 530, "y": 190 },
    "accessByRole": {
      "sales": { "read": true, "create": true, "write": true, "unlink": false },
      "manager": { "read": true, "create": true, "write": true, "unlink": true }
    },
    "recordScopeByRole": {
      "sales": "[('user_id', '=', user.id)]",
      "manager": "[(1, '=', 1)]"
    },
    "fields": [
      {
        "id": "order_amount",
        "name": "销售金额",
        "technicalName": "amount_total",
        "fieldType": "monetary",
        "accessByRole": {
          "sales": "editable",
          "manager": "editable"
        }
      }
    ]
  }
]
```

### Model 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 模型唯一标识 |
| `name` | string | 是 | 界面显示名称 |
| `technicalName` | string | 是 | Odoo 模型技术名称，如 `sale.order` |
| `module` | string | 是 | 所属模块名称 |
| `position` | object | 是 | 画布位置，`{ x: number, y: number }` |
| `accessByRole` | object | 是 | 每个角色的 CRUD 权限 |
| `recordScopeByRole` | object | 是 | 每个角色的记录规则 Domain |
| `fields` | array | 是 | 字段定义列表 |

### accessByRole 取值

每个角色的权限对象包含四个布尔值：

```json
{
  "read": true,
  "create": true,
  "write": true,
  "unlink": false
}
```

- `read`：读取权限
- `create`：创建权限
- `write`：修改权限
- `unlink`：删除权限

### recordScopeByRole 取值

值为 Odoo domain 字符串，例如：

- `"[(1, '=', 1)]"`：所有记录
- `"[('user_id', '=', user.id)]"`：只看自己的记录
- `"[('state', 'in', ['sale', 'done'])]"`：指定状态的记录

### 字段权限取值

`accessByRole` 中每个字段对某个角色的权限只能是以下四种之一：

| 值 | 含义 |
|------|------|
| `hidden` | 隐藏 |
| `readonly` | 只读 |
| `editable` | 可编辑 |
| `masked` | 脱敏 |

## workflow（流程设计）

```json
{
  "model": "sale.order",
  "states": [
    { "id": "draft", "name": "草稿", "technicalValue": "draft", "x": 55, "y": 150 }
  ],
  "transitions": [
    {
      "id": "send_quote",
      "name": "发送报价",
      "from": "draft",
      "to": "sent",
      "allowedRoleIds": ["sales", "manager"],
      "condition": "订单至少包含一个产品行",
      "actions": ["发送报价邮件"]
    }
  ]
}
```

### states 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 状态唯一标识 |
| `name` | string | 是 | 状态显示名称 |
| `technicalValue` | string | 是 | Odoo 中实际存储的值 |
| `x` | number | 是 | 流程图 X 坐标 |
| `y` | number | 是 | 流程图 Y 坐标 |

### transitions 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 转换唯一标识 |
| `name` | string | 是 | 转换显示名称 |
| `from` | string | 是 | 起始状态 id |
| `to` | string | 是 | 目标状态 id |
| `allowedRoleIds` | string[] | 是 | 允许执行该转换的角色 id 列表 |
| `condition` | string | 是 | 转换前置条件描述 |
| `actions` | string[] | 是 | 转换触发的自动动作描述 |

## 最小可导入示例

```json
{
  "id": "my-permission-demo",
  "name": "我的权限测试",
  "odooVersion": "19.0",
  "roles": [
    {
      "id": "sales",
      "name": "销售人员",
      "technicalName": "group_sale_user"
    },
    {
      "id": "manager",
      "name": "销售经理",
      "technicalName": "group_sale_manager",
      "inherits": ["sales"]
    }
  ],
  "users": [
    {
      "id": "u1",
      "name": "张三",
      "email": "zhangsan@test.com",
      "company": "Test",
      "roleIds": ["sales"]
    }
  ],
  "models": [
    {
      "id": "sale_order",
      "name": "销售订单",
      "technicalName": "sale.order",
      "module": "Sales",
      "position": { "x": 300, "y": 100 },
      "accessByRole": {
        "sales": { "read": true, "create": true, "write": true, "unlink": false },
        "manager": { "read": true, "create": true, "write": true, "unlink": true }
      },
      "recordScopeByRole": {
        "sales": "[('user_id', '=', user.id)]",
        "manager": "[(1, '=', 1)]"
      },
      "fields": [
        {
          "id": "amount",
          "name": "金额",
          "technicalName": "amount_total",
          "fieldType": "monetary",
          "accessByRole": {
            "sales": "editable",
            "manager": "editable"
          }
        }
      ]
    }
  ],
  "workflow": {
    "model": "sale.order",
    "states": [],
    "transitions": []
  }
}
```

## 常见问题

### 导入报"文件格式不正确"

请检查 JSON 中是否包含以下顶层字段：

- `id`
- `roles`（必须是数组）
- `models`（必须是数组）

如果缺少其中任意一个，导入就会失败。

### 导入后没有显示预期内容

- 检查 `roles` 中的 `id` 是否与 `models.accessByRole`、`models.recordScopeByRole`、`fields.accessByRole` 中的 key 一致
- 检查 `users` 中的 `roleIds` 是否引用了存在的角色 id
- 检查 `workflow.transitions` 中的 `from` 和 `to` 是否对应存在的 `states` id

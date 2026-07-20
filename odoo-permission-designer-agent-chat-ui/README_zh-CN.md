# Odoo 权限与流程设计器

这是一个面向 `langchain-ai/agent-chat-ui` 的可复制前端 Overlay，并附带最小 LangGraph Python 后端。

## 已实现

- 左侧沿用 Agent Chat UI 的 LangGraph 实时聊天。
- 右侧提供角色—模型—字段权限关系图。
- 支持模型 CRUD ACL、记录规则 Domain、字段隐藏/只读/编辑/脱敏。
- 支持字段权限矩阵。
- 支持销售订单状态流程及转换角色配置。
- 支持权限冲突检查。
- 支持生成 `ir.model.access.csv`、`ir.rule` XML 和字段安全计划。
- 当前可视化状态会作为 `context.permission_design` 随聊天消息发送给 LangGraph。
- Agent 回复中的 `permission_patch` JSON 会自动应用到右侧画布。

## 1. 获取 Agent Chat UI

```bash
git clone https://github.com/langchain-ai/agent-chat-ui.git
cd agent-chat-ui
pnpm install
```

## 2. 覆盖前端文件

### Windows PowerShell

在本项目根目录执行：

```powershell
.\apply-overlay.ps1 -AgentChatUiPath "D:\projects\agent-chat-ui"
```

### 手动复制

将：

```text
frontend-overlay/src/app/page.tsx
```

覆盖到：

```text
agent-chat-ui/src/app/page.tsx
```

将：

```text
frontend-overlay/src/components/permission-designer
```

复制到：

```text
agent-chat-ui/src/components/permission-designer
```

此版本仅使用 Agent Chat UI 已有的 React、Tailwind、Lucide 和 Sonner 依赖，不需要修改 `package.json`。

## 3. 启动 LangGraph 后端

```bash
cd backend
python -m venv .venv
```

Windows：

```powershell
.\.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
langgraph dev
```

macOS/Linux：

```bash
source .venv/bin/activate
pip install -e .
cp .env.example .env
langgraph dev
```

在 `.env` 中填写模型密钥。默认 Graph ID 为：

```text
permission_agent
```

## 4. 配置 Agent Chat UI

在 Agent Chat UI 根目录创建 `.env`：

```env
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=permission_agent
NEXT_PUBLIC_AUTH_SCHEME=
```

然后启动：

```bash
pnpm dev
```

浏览器访问：

```text
http://localhost:3000
```

## 5. 通过聊天修改画布

示例：

```text
销售人员不允许删除销售订单，并且毛利率字段完全隐藏；销售经理可以只读查看毛利率。
```

Agent 应在正常解释后生成：

```permission_patch
{
  "summary": "收紧销售订单删除权限并调整毛利率字段权限",
  "operations": [
    {
      "op": "set_model_access",
      "roleId": "sales",
      "modelId": "sale_order",
      "operation": "unlink",
      "value": false
    },
    {
      "op": "set_field_access",
      "roleId": "sales",
      "modelId": "sale_order",
      "fieldId": "order_margin",
      "value": "hidden"
    },
    {
      "op": "set_field_access",
      "roleId": "manager",
      "modelId": "sale_order",
      "fieldId": "order_margin",
      "value": "readonly"
    }
  ]
}
```

前端会从最新 AI 消息中解析该块并更新右侧状态。

## 6. 下一步接入真实 Odoo

当前数据位于 `mock-data.ts`。生产实现建议增加 FastAPI/Odoo Adapter，读取：

- `ir.model`
- `ir.model.fields`
- `res.groups`
- `res.users`
- `ir.model.access`
- `ir.rule`
- `ir.ui.view`
- `ir.ui.menu`

并将 `PermissionProject` 作为统一 DSL。部署阶段必须同时生成服务端安全规则，不能仅依靠前端隐藏字段或按钮。

# Odoo 权限与流程设计器

这是一个面向 `langchain-ai/agent-chat-ui` 的可视化权限设计方案，包含一个前端 Overlay 和一个最小 LangGraph Python 后端。

它的目标是：

- 用聊天方式描述 Odoo 权限调整需求
- 在右侧画布中可视化编辑权限关系
- 将 AI 回复中的结构化 `permission_patch` 自动应用到画布
- 帮助你快速生成 Odoo ACL、记录规则和字段权限草案

## 当前功能

### 聊天区
- 左侧沿用 Agent Chat UI 的对话体验
- 支持与 LangGraph Agent 进行实时消息流交互
- 支持把当前权限设计作为 `context.permission_design` 发送给后端

### 权限设计区
- 角色、模型、字段的可视化权限关系图
- 模型 ACL 管理：`read` / `create` / `write` / `unlink`
- 记录范围（Record Scope / `ir.rule.domain_force`）编辑
- 字段权限管理：`hidden` / `readonly` / `editable` / `masked`
- 字段权限矩阵批量编辑
- 权限冲突检查
- 生成 Odoo 代码草案

### AI 协作
- Agent 可以输出 `permission_patch` JSON 块
- 前端会自动解析并应用这些变更
- 支持导入 / 导出权限设计 JSON

> 说明：当前版本已移除独立的 `workflow` 设计板块，流程能力由其他工具承担。

---

## 仓库结构

```text
backend/               LangGraph 后端
frontend-overlay/      可覆盖到 Agent Chat UI 的前端源码
apply-overlay.ps1      Windows 下一键覆盖脚本
README_zh-CN.md        中文说明文档
```

---

## 运行前准备

### 后端
- Python 3.10+（建议 3.11）
- 能访问你配置的大模型接口
- 安装好后端依赖

### 前端
- Node.js 18+（建议 20+）
- `pnpm`
- 以 `langchain-ai/agent-chat-ui` 作为宿主项目

---

## 1. 启动后端 LangGraph

进入后端目录：

```bash
cd backend
```

创建虚拟环境并安装依赖：

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

复制环境文件：

```bash
cp .env.example .env
```

然后编辑 `backend/.env`，至少配置以下内容：

```env
OPENAI_API_KEY=your_key_here
OPENAI_API_BASE=https://your-openai-compatible-endpoint/v1
MODEL=openai:your-model-name
LANGSMITH_TRACING=false
```

启动 LangGraph：

```bash
langgraph dev
```

默认图名称为：

```text
permission_agent
```

---

## 2. 配置前端 Agent Chat UI

本仓库提供了前端 Overlay 文件，需要覆盖到宿主项目 `agent-chat-ui` 中。

### 方法一：使用脚本覆盖（Windows）

在本仓库根目录执行：

```powershell
.\apply-overlay.ps1 -AgentChatUiPath "D:\projects\agent-chat-ui"
```

将路径替换成你的实际 `agent-chat-ui` 目录。

### 方法二：手动复制

把以下目录 / 文件覆盖到宿主项目：

```text
frontend-overlay/src/app/page.tsx
frontend-overlay/src/app/layout.tsx
frontend-overlay/src/components/
frontend-overlay/src/i18n/
frontend-overlay/src/providers/
frontend-overlay/src/lib/
frontend-overlay/src/hooks/
```

如果宿主项目已有同路径文件，以本仓库版本为准。

---

## 3. 配置前端环境变量

在宿主项目 `agent-chat-ui` 根目录创建或修改 `.env`：

```env
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=permission_agent
NEXT_PUBLIC_AUTH_SCHEME=
```

如果你的 LangGraph 后端不是本机地址，请改成实际可访问的地址。

### 如果使用 HTTPS 域名

建议让前端请求同源路径或 HTTPS API 域名，避免 Mixed Content 问题。例如：

```env
NEXT_PUBLIC_API_URL=https://uigraph.example.com/api
```

并在 Nginx 中把 `/api` 反代到 LangGraph 后端。

---

## 4. 启动前端

在宿主 `agent-chat-ui` 目录执行：

```bash
pnpm install
pnpm dev
```

然后访问：

```text
http://localhost:3000
```

---

## 5. 如何使用

1. 在左侧输入需求，例如：

```text
销售人员不允许删除销售订单，并且客户电话字段对销售人员隐藏。
```

2. Agent 会根据当前画布里的 `permission_design` 上下文给出回复
3. 如果 Agent 输出 `permission_patch`，前端会自动把补丁应用到右侧画布
4. 你可以继续手动调整或再次让 AI 修改

---

## 6. 权限补丁格式

Agent 需要输出类似如下内容：

```permission_patch
{
  "summary": "收紧销售订单删除权限并隐藏客户电话",
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
      "modelId": "partner",
      "fieldId": "partner_phone",
      "value": "hidden"
    }
  ]
}
```

### 支持的操作
- `set_model_access`
- `set_field_access`
- `set_record_scope`
- `move_model`

> 说明：当前版本不再支持 `workflow` 相关补丁操作。

---

## 7. 常见问题

### 7.1 页面显示 Hydration Error
通常是首屏服务端渲染和客户端渲染不一致引起的。

建议：
- 确保前端已重新构建
- 清理浏览器缓存
- 检查语言切换初始化逻辑

### 7.2 浏览器报 Mixed Content
如果网页是 `https://`，但前端 API 仍然请求 `http://`，浏览器会拦截。

建议：
- 让 API 也走 HTTPS
- 或通过同域名 `/api` 路径反代

### 7.3 后端提示 `No module named 'langchain'`
通常是 Python 环境不对，或者没有在正确虚拟环境里启动。

建议使用项目虚拟环境中的 Python：

```powershell
.\.venv\Scripts\python.exe -m langgraph dev
```

### 7.4 AI 一直转圈没有回复
可能原因：
- 模型接口不可达
- `MODEL` 配置不正确
- API 响应太慢
- 后端没有重启

建议先看后端日志，再确认 `.env`。

---

## 8. 安全提醒

### 不要提交真实密钥
以下文件通常不应该提交到 GitHub：

```text
.env
.env.local
.env.production
backend/.env
```

保留示例文件即可，例如：

```text
.env.example
backend/.env.example
```

### 如果密钥已经提交过
请尽快：
- 轮换密钥
- 从 Git 历史中清理敏感信息
- 确保 `.gitignore` 已正确配置

---

## 9. 建议的 `.gitignore`

```gitignore
# env
.env
.env.*
backend/.env
backend/.env.*

# node
node_modules/
.next/
dist/

# python
__pycache__/
*.pyc
.venv/
backend/.venv/

# logs
*.log

# editor
.vscode/
.idea/
```

---

## 10. 后续扩展方向

如果要接入真实 Odoo 环境，建议进一步增加：

- Odoo 元数据读取器
- ACL / ir.rule / ir.ui.view / ir.ui.menu 生成器
- 用户 / 角色同步适配器
- 导入真实模块 XML ID 的能力
- 补丁审计与版本历史

这样可以把当前的“可视化权限草案”升级成真正可落地的权限设计工作台。

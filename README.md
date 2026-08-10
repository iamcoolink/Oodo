# Odoo 权限与流程设计器 —— 使用手册

> 一个基于 LangGraph + Next.js 的可视化 Odoo 权限与流程设计工作台。左侧为对话式助手，右侧为权限设计画布，支持通过自然语言修改 ACL、字段权限、记录规则和工作流。

---

## 1. 项目概述

### 1.1 能做什么

- **对话式权限设计**：可以使用左侧聊天框用中文描述需求，AI 自动转成右侧画布上的权限变更。
- **可视化权限矩阵**：查看/编辑角色对模型的 CRUD 权限、字段级权限（hidden / readonly / editable / masked）。
- **记录规则**：为角色编写 Odoo `domain_force` 规则。
- **工作流设计**：配置审批流转和条件。
- **代码生成**：一键导出 ACL CSV、记录规则 XML、字段安全说明。
- **导入/导出 JSON**：保存和恢复整个权限项目。

### 1.2 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器 (Browser)                        │
│  ┌──────────────────┐  ┌─────────────────────────────────┐  │
│  │   对话面板        │  │      权限设计画布 (PermissionDesigner) │  │
│  │   (Thread)       │  │      React + Tailwind CSS       │  │
│  └────────┬─────────┘  └─────────────────────────────────┘  │
│           │                                                 │
│           └────────────────┬────────────────────────────────┘
│                            │  SSE / HTTP (port 3001)
├────────────────────────────┼────────────────────────────────┤
│       agent-chat-ui        │  Next.js 15 + shadcn/ui        │
│   (frontend-overlay 定制层) │                                │
├────────────────────────────┴────────────────────────────────┤
│                     API 代理 (Next.js API Routes)            │
│                         port 3001                            │
├────────────────────────────┬────────────────────────────────┤
│       LangGraph 后端        │  Python + LangGraph            │
│      (permission_agent)     │  port 2025                     │
└────────────────────────────┴────────────────────────────────┘
```

### 1.3 目录说明

```
odoo-permission-designer-agent-chat-ui/
├── agent-chat-ui/                  # Next.js 前端（运行目录）
│   ├── src/app/page.tsx            # 入口页面
│   ├── src/components/thread/      # 聊天组件
│   ├── src/components/permission-designer/  # 权限设计器
│   ├── .env                        # 前端环境变量
│   └── package.json
│
├── odoo-permission-designer-agent-chat-ui/
│   ├── backend/                    # LangGraph 后端
│   │   ├── permission_agent/graph.py
│   │   ├── langgraph.json
│   │   ├── .env                    # 后端模型配置
│   │   └── pyproject.toml
│   └── frontend-overlay/           # 前端定制覆盖层
│       ├── src/app/page.tsx
│       ├── src/components/thread/
│       ├── src/components/permission-designer/
│       └── apply-overlay.ps1       # 同步脚本
│
└── README.md                       # 本文件
```

> **重要**：`frontend-overlay` 是定制源码，`agent-chat-ui` 才是实际运行的前端。每次修改 overlay 后，必须运行 `apply-overlay.ps1` 把改动同步到 `agent-chat-ui`，然后再 `pnpm build`。

---

## 2. 环境准备

### 2.1 依赖软件

| 软件 | 版本 | 用途 |
|---|---|---|
| Node.js | ≥ 18 | 前端运行 |
| pnpm | 任意 | 前端包管理 |
| Python | ≥ 3.11 | 后端运行 |
| cpolar / 内网模型 | — | 本地大模型接入（可选） |

### 2.2 安装前端依赖

```powershell
cd e:\working\odoo-permission-designer-agent-chat-ui\agent-chat-ui
pnpm install
```

### 2.3 安装后端依赖

后端已包含 Python 虚拟环境 `.venv`，推荐直接使用：

```powershell
cd e:\working\odoo-permission-designer-agent-chat-ui\odoo-permission-designer-agent-chat-ui\backend
.venv\Scripts\python.exe -m pip install -e .
```

若 `.venv` 损坏，可重新创建：

```powershell
cd e:\working\odoo-permission-designer-agent-chat-ui\odoo-permission-designer-agent-chat-ui\backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e .
```

---

## 3. 配置

### 3.1 后端模型配置（关键）

编辑 `odoo-permission-designer-agent-chat-ui/backend/.env`：

```env
OPENAI_API_KEY=sk-local-placeholder
OPENAI_BASE_URL=https://你的模型地址/v1
MODEL=openai:qwen2.5-coder-7b-instruct
LANGSMITH_TRACING=false
```

#### 常见配置方式

**方式 A：公司本地模型通过 cpolar 暴露**

```env
OPENAI_BASE_URL=https://odoollm.cpolar.top/v1
MODEL=openai:qwen2.5-coder-7b-instruct
```

> 注意：cpolar 免费域名会变动。如果报 `404 domain doesn't exist`，说明隧道域名失效，需要到公司内网确认新的 cpolar 地址。

**方式 B：直连内网 IP**

```env
OPENAI_BASE_URL=http://192.168.x.x:8000/v1
MODEL=openai:qwen2.5-coder-7b-instruct
```

**方式 C：本地 Ollama / vLLM**

```env
OPENAI_BASE_URL=http://localhost:11434/v1
MODEL=openai:qwen2.5-coder:7b
```

#### 重要提醒

- 必须使用 `OPENAI_BASE_URL`，**不要**写 `OPENAI_API_BASE`。新版 OpenAI Python 客户端只识别 `OPENAI_BASE_URL`。
- 后端代码里已经设置了 `streaming=False`，兼容非标准 SSE 的本地模型。
- 修改 `.env` 后必须重启后端才能生效。

### 3.2 前端配置

编辑 `agent-chat-ui/.env`：

```env
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2025
```

如果后端部署在服务器上，改为对应 IP：

```env
NEXT_PUBLIC_LANGGRAPH_API_URL=http://服务器IP:2025
```

---

## 4. 本地开发运行

### 4.1 启动后端

```powershell
cd e:\working\odoo-permission-designer-agent-chat-ui\odoo-permission-designer-agent-chat-ui\backend
langgraph dev --port 2025 --host 0.0.0.0
```

成功后会看到：

```
Ready!
- API: http://0.0.0.0:2025
```

### 4.2 启动前端

```powershell
cd e:\working\odoo-permission-designer-agent-chat-ui\agent-chat-ui
pnpm exec next start -p 3001
```

或开发模式：

```powershell
pnpm dev -p 3001
```

### 4.3 访问

浏览器打开 `http://localhost:3001`。

---

## 5. 修改与定制流程

### 5.1 标准修改流程

本项目采用 **overlay 覆盖层** 机制，避免直接修改 `agent-chat-ui` 源码导致无法追踪。

```
修改 frontend-overlay/ 源码
        ↓
运行 apply-overlay.ps1 同步到 agent-chat-ui
        ↓
进入 agent-chat-ui 执行 pnpm build
        ↓
刷新浏览器 / 重启前端服务
```

### 5.2 同步覆盖层

```powershell
cd e:\working\odoo-permission-designer-agent-chat-ui\odoo-permission-designer-agent-chat-ui
.\apply-overlay.ps1 -AgentChatUiPath "e:\working\odoo-permission-designer-agent-chat-ui\agent-chat-ui"
```

脚本会复制以下文件：

- `frontend-overlay/src/app/page.tsx` → `agent-chat-ui/src/app/page.tsx`
- `frontend-overlay/src/app/layout.tsx` → `agent-chat-ui/src/app/layout.tsx`
- `frontend-overlay/src/app/icon.svg` / `icon1.png` → `agent-chat-ui/src/app/`
- `frontend-overlay/src/components/permission-designer/*` → `agent-chat-ui/src/components/permission-designer/`
- `frontend-overlay/src/components/thread/index.tsx` → `agent-chat-ui/src/components/thread/index.tsx`
- `frontend-overlay/src/components/thread/messages/ai.tsx` → `agent-chat-ui/src/components/thread/messages/ai.tsx`
- `frontend-overlay/src/components/thread/messages/human.tsx` → `agent-chat-ui/src/components/thread/messages/human.tsx`
- `frontend-overlay/src/components/icons/langgraph.tsx` → `agent-chat-ui/src/components/icons/langgraph.tsx`

### 5.3 构建前端

```powershell
cd e:\working\odoo-permission-designer-agent-chat-ui\agent-chat-ui
pnpm build
```

### 5.4 开发时快速验证

本地开发可以直接在 `agent-chat-ui` 里改代码看效果，但**最终必须同步回 `frontend-overlay`**，否则下次运行 `apply-overlay.ps1` 会被覆盖。

---

## 6. 部署到服务器

### 6.1 使用 systemd 自启（推荐）

#### 后端服务

创建 `/etc/systemd/system/permission-designer-backend.service`：

```ini
[Unit]
Description=Permission Designer LangGraph Backend
After=network.target

[Service]
Type=simple
User=你的用户
WorkingDirectory=/path/to/odoo-permission-designer-agent-chat-ui/odoo-permission-designer-agent-chat-ui/backend
EnvironmentFile=/path/to/odoo-permission-designer-agent-chat-ui/odoo-permission-designer-agent-chat-ui/backend/.env
ExecStart=/path/to/odoo-permission-designer-agent-chat-ui/odoo-permission-designer-agent-chat-ui/backend/.venv/bin/langgraph dev --port 2025 --host 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### 前端服务

创建 `/etc/systemd/system/permission-designer-frontend.service`：

```ini
[Unit]
Description=Permission Designer Next.js Frontend
After=network.target

[Service]
Type=simple
User=你的用户
WorkingDirectory=/path/to/odoo-permission-designer-agent-chat-ui/agent-chat-ui
EnvironmentFile=/path/to/odoo-permission-designer-agent-chat-ui/agent-chat-ui/.env
ExecStart=/usr/bin/pnpm exec next start -p 3001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### 启用并启动

```bash
sudo systemctl daemon-reload
sudo systemctl enable permission-designer-backend.service permission-designer-frontend.service
sudo systemctl start permission-designer-backend.service permission-designer-frontend.service
```

### 6.2 更新部署流程

每次修改后，按此顺序执行：

```bash
# 1. 本地修改 frontend-overlay，然后同步
cd /path/to/odoo-permission-designer-agent-chat-ui/odoo-permission-designer-agent-chat-ui
./apply-overlay.ps1 -AgentChatUiPath "/path/to/odoo-permission-designer-agent-chat-ui/agent-chat-ui"

# 2. 构建前端
cd /path/to/odoo-permission-designer-agent-chat-ui/agent-chat-ui
pnpm build

# 3. 重启前端服务
sudo systemctl restart permission-designer-frontend.service

# 如果后端 .env 有变，也重启后端
sudo systemctl restart permission-designer-backend.service
```


## 7. 使用指南

### 7.1 开始对话

1. 打开页面，左侧看到 "Odoo ERP" 标题和输入框。
2. 在输入框中描述权限需求，例如：
   - "给销售经理增加销售订单的写权限"
   - "金额超过5万元时增加两级审批"
   - "把客户电话字段对普通销售员隐藏"
3. 按 Enter 发送，AI 会返回解释并在右侧应用变更。

### 7.2 右侧权限设计器

顶部按钮：

- **检查**：验证当前设计是否有冲突。
- **导出 JSON**：下载完整项目文件。
- **导入 JSON**：上传项目文件恢复设计。
- **保存**：保存到浏览器状态（实际为前端内存）。

工作区标签：

- **权限关系图**：可视化模型与角色的关系。
- **字段矩阵**：查看/编辑字段级权限。
- **流程设计**：配置工作流审批。
- **Odoo 代码**：生成 ACL CSV、记录规则 XML、字段安全说明。

### 7.3 导入 JSON 格式

导入的 JSON 必须包含 `tables` 数组。缺失字段会自动填充默认值。工作流转换默认空数组。

示例结构见：`odoo-permission-designer-agent-chat-ui/json导入格式.md`

---

## 8. 常见问题排查

### 8.1 前端页面报 `APIConnectionError: An internal error occurred`

**原因**：后端连不上模型 API。  
**排查**：

1. 后端是否正常启动？
   ```bash
   sudo systemctl status permission-designer-backend.service
   ```
2. `.env` 中是否为 `OPENAI_BASE_URL`？
3. 模型地址是否能访问？
   ```powershell
   .venv\Scripts\python.exe -c "from openai import OpenAI; OpenAI().models.list()"
   ```
4. cpolar 域名是否失效？在浏览器直接访问 `https://你的地址/v1/models` 看是否返回模型列表。

### 8.2 后端报 `openai.NotFoundError: 404 domain doesn't exist`

**原因**：cpolar 隧道域名失效或本地模型服务未启动。  
**解决**：到公司内网确认 cpolar 隧道状态，获取新的地址并更新 `backend/.env` 中的 `OPENAI_BASE_URL`。

### 8.3 修改后部署到服务器没有生效

**原因**：Next.js 需要重新构建。  
**解决**：

```bash
cd agent-chat-ui
pnpm build
sudo systemctl restart permission-designer-frontend.service
```

并清空浏览器缓存。

### 8.4 构建时报 `EPERM: operation not permitted, open '.next\trace'`

**原因**：有另一个 Next.js 进程占用了 `.next` 目录。  
**解决**：

```powershell
# 停止所有前端相关进程
Get-Process node | Select-Object Id, Path
Stop-Process -Id <前端对应的 PID>

# 删除缓存并重新构建
cd agent-chat-ui
Remove-Item -Recurse -Force .next
pnpm build
```

### 8.5 构建时报 `Cannot find module for page: /_document`

**原因**：`.next` 缓存损坏。  
**解决**：

```powershell
cd agent-chat-ui
Remove-Item -Recurse -Force .next
pnpm build
```

### 8.6 502 Bad Gateway

**原因**：Nginx 无法连到后端或前端服务。  
**排查**：

```bash
sudo systemctl status permission-designer-frontend.service
sudo systemctl status permission-designer-backend.service
ss -tlnp | grep -E '3001|2025'
```

确认两个端口都在监听，再检查 Nginx 配置。

---

## 9. 开发与扩展

### 9.1 添加新的权限操作

1. 在 `frontend-overlay/src/components/permission-designer/types.ts` 中定义类型。
2. 在 `frontend-overlay/src/components/permission-designer/patch.ts` 中实现补丁解析和应用逻辑。
3. 在 `backend/permission_agent/graph.py` 的 `SYSTEM_PROMPT` 中告诉 AI 新操作的格式。
4. 同步 overlay、构建、重启前端。

### 9.2 修改 AI 提示词

编辑 `backend/permission_agent/graph.py` 中的 `SYSTEM_PROMPT`，修改后重启后端即可生效。

### 9.3 调整 UI 样式

所有样式基于 Tailwind CSS。常用 Odoo 主题色：

- 主紫色：`#714B67`
- 浅粉色：`#F5E6F0`
- 边框粉：`#E9D5E6`

---

## 10. 附录

### 10.1 常用命令速查

```powershell
# 启动后端（本地）
cd odoo-permission-designer-agent-chat-ui/backend
langgraph dev --port 2025 --host 0.0.0.0

# 启动前端（本地）
cd agent-chat-ui
pnpm exec next start -p 3001

# 同步覆盖层
cd odoo-permission-designer-agent-chat-ui
.\apply-overlay.ps1 -AgentChatUiPath "..\agent-chat-ui"

# 构建前端
cd agent-chat-ui
pnpm build

# 验证模型连接
cd odoo-permission-designer-agent-chat-ui/backend
.venv\Scripts\python.exe -c "from openai import OpenAI; print(OpenAI().models.list())"
```

### 10.2 关键文件索引

| 文件 | 说明 |
|---|---|
| `agent-chat-ui/.env` | 前端 API 地址 |
| `odoo-permission-designer-agent-chat-ui/backend/.env` | 模型 API 配置 |
| `odoo-permission-designer-agent-chat-ui/backend/permission_agent/graph.py` | AI 提示词与调用逻辑 |
| `odoo-permission-designer-agent-chat-ui/backend/langgraph.json` | LangGraph 服务配置 |
| `frontend-overlay/src/app/page.tsx` | 页面整体布局 |
| `frontend-overlay/src/components/thread/index.tsx` | 聊天面板 |
| `frontend-overlay/src/components/permission-designer/index.tsx` | 权限设计器 |
| `frontend-overlay/src/components/permission-designer/patch.ts` | 权限补丁解析与应用 |
| `frontend-overlay/apply-overlay.ps1` | 同步脚本 |

---

*最后更新：2026-07-22*

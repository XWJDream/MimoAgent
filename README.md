# MimoAgent Desktop

**AI 驱动的智能编程助手桌面端**

基于 MiMo 大模型的 AI 编程工作台，支持代码生成、调试、重构、项目分析与语音合成。

---

## 下载安装

> 普通用户直接下载安装包即可使用，无需开发环境。

前往 [Releases](https://github.com/XWJDream/MimoAgent/releases) 页面下载最新版本：

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `MimoAgent Setup 0.2.0.exe` | 最新安装包 |
| Windows | `MimoAgent Setup 0.1.0.exe` | 旧版本 |

> 首次启动需要在 **设置** 中配置 API Key。前往 [小米 MiMo 开放平台](https://ai.mi.com) 获取。

### ⚠️ Windows SmartScreen 提示

下载 exe 后可能弹出 **"Windows 已保护你的电脑"**，这是 SmartScreen 对新程序的正常拦截，并非病毒。处理方式：

1. 右键 exe → **属性** → 勾选 **"解除锁定"** → 确定 → 运行
2. 或点击 **"更多信息"** → **"仍要运行"**

> 本项目完全开源，代码可审计。如有安全顾虑可自行克隆源码构建。

### API 端点说明

MiMo 提供两种 API 端点，根据你的计费方式选择：

| 端点 | 说明 |
|------|------|
| `https://api.xiaomimimo.com/v1` | 标准 API（推荐） |
| `https://token-plan-cn.xiaomimimo.com/v1` | Token 计划专用 |

在 **设置 → API 地址** 中修改，默认为 `api.xiaomimimo.com`。

---

## 功能特性

### 核心能力

- **AI 对话** — 基于 MiMo v2.5 Pro 模型，支持上下文理解与多轮对话
- **代码工具** — 文件读写、Shell 执行、Git 操作、Web 抓取等，Agent 自主调用
- **MCP 插件** — Model Context Protocol 扩展，自由添加第三方工具
- **自动化规则** — 文件变更监听、定时任务、手动触发
- **TTS 语音合成** — 9 种音色、语速调节、思考强度控制

### v0.2.0 新增

- **智能 System Prompt** — 自动注入环境信息（工作目录、Git 状态、平台、日期、项目文件树）
- **上下文压缩** — 对话超长时自动调用 LLM 生成结构化摘要，保留关键信息
- **工具预设模式** — `plan`（只读分析）/ `act`（完整操作）切换
- **项目上下文文件** — 支持 `MIMO.md` / `.mimo-rules` 注入项目特定指令
- **Web 抓取工具** — Agent 可直接访问网页查文档、查 API 参考
- **Git Checkpoint** — 写文件前自动创建 stash 检查点，支持回滚
- **Diff 预览** — edit/write 工具执行后自动显示变更差异
- **消息编辑** — 编辑历史消息并重新生成回复
- **重新生成** — 对不满意的回复一键重新生成
- **Hook 系统** — beforeTool/afterTool 钩子，支持工具执行拦截和修改
- **路径级权限** — `.env` 写入需确认，`.git` 目录禁止修改，支持自定义规则
- **沙盒模式** — Docker 隔离执行（需安装 Docker，设置中开启）
- **会话持久化** — 重启应用后自动恢复对话历史
- **API 验证** — 启动时自动检测 API Key 有效性，状态栏实时显示
- **循环检测** — Agent 重复调用相同工具时自动停止

### 内置工具

| 工具 | 说明 | plan 模式 |
|------|------|-----------|
| `read_file` | 读取文件内容 | ✅ |
| `write_file` | 写入文件（含 diff 预览） | ❌ |
| `edit_file` | 编辑文件（含 diff 预览） | ❌ |
| `grep` | 搜索文件内容 | ✅ |
| `glob` | 搜索文件路径 | ✅ |
| `shell` | 执行 Shell 命令 | ❌ |
| `web_fetch` | 抓取网页内容 | ✅ |
| `git_status` | 查看 Git 状态 | ✅ |
| `git_commit` | 提交代码 | ❌ |
| `git_checkpoint` | 创建检查点 | ✅ |
| `task_*` | 任务管理 | ✅ |

---

## 开发者指南

### 环境要求

- Node.js >= 18
- npm >= 9

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/XWJDream/MimoAgent.git
cd MimoAgent

# 安装依赖
npm install
cd engine && npm install && cd ..

# 配置 API Key
cp .env.example .env
# 编辑 .env 填入你的 MIMO_API_KEY

# 启动开发模式
npm run start:dev
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run start:dev` | 启动 Vite + Electron 开发模式 |
| `npm run build` | 完整构建（engine + main + preload + renderer） |
| `npx electron-builder --win` | 打包 Windows 安装包 |
| `npm --prefix engine run dev -- "prompt"` | 直接运行 Agent CLI |

### 项目结构

```
MimoAgent/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 安全桥接层
│   ├── renderer/       # React UI
│   │   ├── components/ # 界面组件
│   │   ├── stores/     # Zustand 状态管理
│   │   └── styles/     # 全局样式
│   └── shared/         # 共享类型与 IPC 通道
├── engine/             # Agent 引擎（独立 npm 包）
│   └── src/
│       ├── core/       # Agent 循环、子 Agent、Hook 系统
│       ├── tools/      # 内置工具（文件、Shell、Git、Web）
│       ├── permissions/# 权限检查（路径级规则）
│       ├── context/    # System Prompt、上下文压缩、使用统计
│       ├── sandbox/    # Docker 沙盒、本地进程执行
│       ├── llm/        # LLM 客户端、流式处理、Token 估算
│       └── config/     # 配置加载、校验、默认值
├── resources/          # 应用图标
└── scripts/            # 开发辅助脚本
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端 | React 19 + TypeScript 5.7 |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 4 + CSS Variables |
| 状态管理 | Zustand 5 |
| LLM 客户端 | OpenAI SDK（兼容 MiMo API） |
| Markdown | marked + DOMPurify |
| 图标 | lucide-react |

---

## 配置说明

应用读取项目根目录 `.env` 文件，也支持在设置面板中运行时修改。

| 变量 | 说明 |
|------|------|
| `MIMO_API_KEY` | API 密钥 |
| `MIMO_API_BASE` | API 地址，默认 `https://api.xiaomimimo.com/v1` |
| `MIMO_MODEL` | 默认模型，如 `mimo-v2.5-pro` |
| `MIMO_PERMISSION_MODE` | 权限模式：`suggest` / `auto-edit` / `full-auto` |
| `MIMO_MAX_TURNS` | 最大对话轮次 |

### 项目上下文文件

在项目根目录创建以下文件，内容会自动注入到 Agent 的 System Prompt：

- `MIMO.md` — 项目特定指令（推荐）
- `.mimo-rules` — 规则文件
- `CLAUDE.md` / `.clinerules` — 兼容其他工具的格式

### 路径权限规则

内置敏感路径保护：

| 路径 | 操作 | 策略 |
|------|------|------|
| `**/.env*` | 写入/编辑/Shell | 需确认 |
| `**/.git/**` | 写入/编辑/Shell | 禁止 |
| `**/node_modules/**` | 写入/编辑/Shell | 禁止 |

---

## 致谢

- [小米 MiMo](https://ai.mi.com) — 提供 MiMo 大模型 API 支持
- [Cline](https://github.com/cline/cline) — 架构设计参考
- [OpenCode](https://github.com/opencode-ai/opencode) — System Prompt 和工具设计参考
- [Electron](https://www.electronjs.org/) / [React](https://react.dev/) / [Vite](https://vitejs.dev/) / [Tailwind CSS](https://tailwindcss.com/) — 技术栈

---

## 许可证

MIT License

---

> 如果这个项目对你有帮助，欢迎 Star 支持！

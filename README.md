# MimoAgent Desktop

**AI 驱动的智能编程助手桌面端**

基于 MiMo 大模型的 AI 编程工作台，支持代码生成、调试、重构、项目分析、多 Agent 协同与语音合成。

---

## 下载安装

> 普通用户直接下载安装包即可使用，无需开发环境。

前往 [Releases](https://github.com/XWJDream/MimoAgent/releases) 页面下载最新版本：

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `MimoAgent Setup 0.3.0.exe` | 最新安装包 |
| Windows | `MimoAgent Setup 0.2.0.exe` | 旧版本 |

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
- **MCP 插件** — Model Context Protocol 扩展，自由添加第三方工具（实验性）
- **自动化规则** — 文件变更监听、定时任务、手动触发（实验性）
- **TTS 语音合成** — 9 种音色、语速调节、思考强度控制
- **i18n 国际化** — 支持中文/英文切换

### v0.3.0 新增

- **智能技能加载** — 7 个内置技能（代码审查、重构、调试、测试、文档、Git、架构），关键词匹配自动推荐
- **可视化控制台** — 系统信息监控（CPU、内存、磁盘）、实时日志流
- **多 Agent 协同** — 子 Agent 状态追踪、任务依赖图、右侧 Inspector 面板实时展示
- **Agent 编程督导** — 代码质量检查规则引擎、违规记录与统计
- **上下文窗口优化** — 参考 Cline/OpenCode 设计，区分累计统计和当前上下文，Token 格式化显示（110K、1.2M）
- **分级压缩策略** — 轻度（<70%）、中度（70-85%）、重度（>85%），保留关键上下文
- **Stream Token 修复** — 修复 stream 模式下 usage 数据丢失问题
- **配置持久化** — API Key、设置项重启后自动保留
- **客户端缓存统计** — 基于前缀缓存原理估算缓存命中率

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
- **输出校验** — 自动验证工具参数和执行结果，提供错误警告和建议
- **自我反思** — 任务完成后自动评估结果质量，必要时提示重试
- **权限确认 GUI** — 原生对话框确认高风险操作

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

## 测试

项目包含完整的单元测试套件，确保代码质量和稳定性。

### 测试覆盖率

| 模块 | 测试文件 | 测试用例 | 覆盖率 |
|------|----------|----------|--------|
| 权限检查器 | `checker.test.ts` | 17 | ~80% |
| 使用量追踪器 | `usage-tracker.test.ts` | 19 | ~80% |
| 文件缓存 | `file-cache.test.ts` | 15 | ~70% |
| 项目记忆 | `memory.test.ts` | 12 | ~70% |
| LLM 客户端 | `client.test.ts` | 8 | ~60% |
| 流式处理 | `streaming.test.ts` | 19 | ~80% |
| 重试逻辑 | `retry.test.ts` | 10 | ~70% |
| 输出校验 | `validator.test.ts` | 22 | ~90% |
| Shell 工具 | `shell.test.ts` | 24 | ~90% |
| 文件工具 | `read/write/edit-file.test.ts` | 52 | ~90% |
| 搜索工具 | `glob/grep.test.ts` | 32 | ~85% |
| 网页抓取 | `web-fetch.test.ts` | 24 | ~80% |
| 进程执行 | `process.test.ts` | 16 | ~70% |
| 配置管理 | `configStore.test.ts` | 19 | ~60% |
| 会话管理 | `sessionStore.test.ts` | 17 | ~70% |
| 子代理 | `sub-agent.test.ts` | 5 | ~60% |
| Agent 循环 | `agent-loop.test.ts` | 8 | ~50% |

**总计：28 个测试文件，324 个测试用例，总体覆盖率约 70%**

### 运行测试

```bash
# 运行所有测试
npm test

# 运行引擎测试
npm run test:engine

# 运行主进程测试
npm run test:main

# 运行渲染进程测试
npm run test:renderer

# 运行实时 API 测试（需要 API Key）
MIMO_LIVE_TESTS=1 MIMO_API_KEY=your-key npm run test:live
```

---

## 开发者指南

### 环境要求

- Node.js >= 22
- npm >= 9

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/XWJDream/MimoAgent.git
cd MimoAgent

# 安装依赖
npm ci
npm --prefix engine ci

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
| `npm run clean` | 清理 dist 和 engine/dist |
| `npm run package:win` | 打包 Windows 安装包 |
| `npm test` | 运行所有测试 |
| `npm run lint` | 代码检查 |
| `npm run typecheck` | 类型检查 |

### 项目结构

```
MimoAgent/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 安全桥接层
│   ├── renderer/       # React UI
│   │   ├── components/ # 界面组件
│   │   │   ├── chat/        # 聊天面板
│   │   │   ├── skills/      # 智能技能
│   │   │   ├── console/     # 可视化控制台
│   │   │   ├── supervisor/  # Agent 督导
│   │   │   └── tools/       # Inspector 面板
│   │   ├── stores/     # Zustand 状态管理
│   │   ├── i18n/       # 国际化（中/英）
│   │   └── styles/     # 全局样式
│   └── shared/         # 共享类型与 IPC 通道
├── engine/             # Agent 引擎（独立 npm 包）
│   └── src/
│       ├── core/       # Agent 循环、子 Agent、Hook 系统、校验器
│       ├── tools/      # 内置工具（文件、Shell、Git、Web）
│       ├── permissions/# 权限检查（路径级规则）
│       ├── context/    # System Prompt、上下文压缩、使用统计
│       ├── sandbox/    # Docker 沙盒、本地进程执行
│       ├── llm/        # LLM 客户端、流式处理、Token 估算
│       ├── skills/     # 技能注册、匹配引擎
│       ├── supervisor/ # 督导规则引擎
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
| 测试 | Vitest 4 |
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

## 安全特性

- **API Key 保护** — 不存储明文，前端脱敏显示
- **路径级权限** — 敏感文件操作需确认
- **命令注入防护** — 危险命令自动拦截
- **XSS 防护** — HTML 内容使用 DOMPurify 消毒
- **内存泄漏防护** — TTS 音频自动清理、toolResults 及时清除
- **循环检测** — 防止 Agent 无限循环
- **CI Secret Scan** — GitHub Actions 自动扫描源码中的密钥泄露

---

## CI/CD

项目使用 GitHub Actions 自动化：

| Workflow | 触发条件 | 内容 |
|----------|----------|------|
| `Build & Test` | push/PR to dev/master | Secret Scan → Lint → Typecheck → Test → Build |
| `Release` | push tag `v*` | 全流程质量门 → Package → Create Release → 上传 exe |

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

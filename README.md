# MimoAgent Desktop
(目前只是第一版测试，欢迎看见的提供意见还有二次开发，功能还不是太完善）
**AI 驱动的智能编程助手桌面端**

基于 MiMo 大模型的 AI 编程工作台，支持代码生成、调试、重构、项目分析与语音合成。

---

## 下载安装

> 普通用户直接下载安装包即可使用，无需开发环境。

前往 [Releases](https://github.com/XWJDream/MimoAgent/releases) 页面下载最新版本：

| 平台 | 文件 | 说明 |
|------|------|------|
| Windows | `MimoAgent Setup 0.1.0.exe` | 安装包，双击运行 |

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

- **AI 对话** — 基于 MiMo v2.5 Pro 模型的智能编程助手，支持上下文理解与多轮对话
- **代码工具** — 内置文件读写、Shell 执行、Git 操作等工具，Agent 可自主调用
- **MCP 插件** — 支持 Model Context Protocol 服务器扩展，自由添加第三方工具
- **自动化规则** — 文件变更监听、定时任务、手动触发等多种自动化场景
- **TTS 语音合成** — 支持 9 种音色、语速调节、思考强度控制，生成 WAV 音频
- **文件浏览** — 内置文件树与代码预览，支持语法高亮
- **会话管理** — 多会话并行，每个会话独立绑定项目目录
- **权限控制** — 建议模式 / 自动编辑 / 全自动三级权限

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
| `npm run package:win` | 打包 Windows 安装包 |
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
│   └── src/            # Agent 循环、工具、权限、沙箱
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

---

## 致谢

- [小米 MiMo](https://ai.mi.com) — 提供 MiMo 大模型 API 支持
- [Electron](https://www.electronjs.org/) / [React](https://react.dev/) / [Vite](https://vitejs.dev/) / [Tailwind CSS](https://tailwindcss.com/) — 技术栈

---

## 许可证

MIT License

---

> 如果这个项目对你有帮助，欢迎 Star 支持！

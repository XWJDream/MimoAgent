# MimoAgent Desktop - AGENTS.md

> 本文档记录 MimoAgent 的 Agent 系统架构、工具链、技能系统、Hook 机制和扩展方式，供开发者和 AI Agent 参考。

---

## 项目概览

MimoAgent 是一个基于 MiMo v2.5 Pro 模型的 AI 编程桌面助手。采用 Electron + React 前端 + 独立 Agent 引擎的双层架构。

```
mimo-desktop/
├── src/                    # Electron 应用层
│   ├── main/               # 主进程（IPC、窗口、AgentService）
│   ├── preload/            # 安全桥接层
│   ├── renderer/           # React UI（组件、状态、样式）
│   └── shared/             # 共享类型和 IPC 通道
├── engine/                 # Agent 引擎（独立 npm 包）
│   └── src/
│       ├── core/           # Agent 循环、子 Agent、Hook、校验
│       ├── tools/          # 内置工具（文件、Shell、Git、Web）
│       ├── llm/            # LLM 客户端、流式处理、Token 估算
│       ├── context/        # System Prompt、上下文压缩
│       ├── config/         # 配置加载、校验、默认值
│       ├── permissions/    # 权限检查（路径级规则）
│       ├── sandbox/        # Docker 沙盒
│       ├── skills/         # 技能注册、匹配引擎
│       ├── supervisor/     # 督导规则引擎
│       └── sub-agents/     # 子 Agent 定义
├── scripts/                # 构建辅助脚本
└── resources/              # 应用图标
```

---

## 1. Agent 核心架构

### 1.1 Agent 类 (`engine/src/core/agent.ts`)

顶层编排器，组装所有子系统：

```typescript
class Agent {
  constructor(config: MimoConfig, workspace?: string)
  initialize(): Promise<void>      // 加载记忆、注册工具、构建 System Prompt
  run(prompt, options): AsyncGenerator<LoopEvent>  // 主运行循环
  clearConversation(): void        // 重置对话
  setHooks(hooks: AgentHooks): void
  getUsageTracker(): UsageTracker
}
```

### 1.2 Agent Loop (`engine/src/core/agent-loop.ts`)

核心循环，`AsyncGenerator<LoopEvent>`：

```
1. 发送消息 + 工具定义到 LLM（流式/非流式）
2. StreamCollector 收集响应（组装 tool_call delta）
3. 无工具调用 → yield done → 结束
4. 有工具调用 → 逐个执行：
   a. 权限检查
   b. 参数校验
   c. 执行工具
   d. 运行 Hook
5. 循环检测：相同 tool+args 重复 3+ 次 → 中止
6. 错误反思：生成反思提示，继续循环
7. 上限：maxTurns（硬限制 100）
```

### 1.3 LoopEvent 类型

| 事件 | 说明 | 关键字段 |
|------|------|---------|
| `text` | 模型输出文本 | `content` |
| `tool_start` | 工具开始执行 | `name`, `args` |
| `tool_result` | 工具执行结果 | `name`, `output`, `isError` |
| `validation` | 参数校验结果 | `level`, `message` |
| `reflection` | 错误反思提示 | `prompt` |
| `done` | 对话完成 | - |
| `error` | 错误 | `message` |

### 1.4 AgentHooks

```typescript
interface AgentHooks {
  beforeTool?: (name: string, args: Record<string, unknown>) =>
    Promise<{ skip?: boolean; modifiedArgs?: Record<string, unknown> } | void>;
  afterTool?: (name: string, result: ToolResult) =>
    Promise<{ modifiedResult?: ToolResult } | void>;
}
```

---

## 2. 内置工具（14 个）

### 工具基类

```typescript
abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: ToolDefinition;  // OpenAI function-calling schema
  abstract riskLevel: 'read' | 'write' | 'execute' | 'destructive';
  abstract categories: string[];
  abstract execute(args: unknown, context: ToolContext): Promise<ToolResult>;
}
```

### 工具列表

| 工具 | 名称 | 风险 | 分类 | 说明 |
|------|------|------|------|------|
| ReadFileTool | `read_file` | read | file | 读取文件内容 |
| WriteFileTool | `write_file` | write | file | 写入文件 + diff 预览 |
| EditFileTool | `edit_file` | write | file | 编辑文件 + diff 预览 |
| GrepTool | `grep` | read | search | 正则搜索文件内容 |
| GlobTool | `glob` | read | search | glob 模式搜索路径 |
| ShellTool | `shell` | execute | shell | 执行 Shell 命令 |
| WebFetchTool | `web_fetch` | read | web | 抓取网页内容 |
| GitStatusTool | `git_status` | read | system | 查看 Git 状态 |
| GitCommitTool | `git_commit` | write | system | 提交代码 |
| GitCheckpointTool | `git_checkpoint` | read | system | 创建 stash 检查点 |
| TaskCreateTool | `task_create` | read | task | 创建任务 |
| TaskUpdateTool | `task_update` | read | task | 更新任务状态 |
| TaskListTool | `task_list` | read | task | 列出任务 |
| SubAgentsRunTool | `sub_agents_run` | execute | task | 运行子 Agent |

### 工具预设

| 预设 | 可用工具 |
|------|---------|
| `plan` | 只读工具（read_file, grep, glob, git_status, git_checkpoint, task_*, web_fetch） |
| `act` | 全部工具 + sub_agents_run |

---

## 3. 子 Agent 系统（5 个）

子 Agent 通过 `sub_agents_run` 工具调用，每个子 Agent 有独立的 System Prompt 和工具集。

| 子 Agent | 说明 | 适用场景 |
|----------|------|---------|
| `coder` | 代码编写 | 实现功能、修复 bug |
| `reviewer` | 代码审查 | 质量检查、安全审计 |
| `tester` | 测试生成 | 单元测试、集成测试 |
| `docgen` | 文档生成 | API 文档、README |
| `architect` | 架构设计 | 模块划分、接口设计 |

### 子 Agent 配置

```typescript
// MimoConfig.subAgents
interface SubAgentConfig {
  enabled: boolean;
  maxConcurrent: number;    // 默认 3
  maxTurns: number;         // 默认 10
}
```

---

## 4. 技能系统（7 个内置）

技能通过关键词匹配自动推荐，也可手动激活。

| 技能 ID | 名称 | 触发关键词 | 优先级 |
|---------|------|-----------|--------|
| `code-review` | 代码审查 | 审查, review, 检查代码 | 8 |
| `refactor` | 代码重构 | 重构, 优化, refactor | 7 |
| `debug` | 调试辅助 | 调试, bug, 错误, debug, fix | 9 |
| `test` | 测试生成 | 测试, test, 单测 | 6 |
| `docs` | 文档生成 | 文档, docs, 注释 | 5 |
| `git-workflow` | Git 工作流 | 提交, commit, 分支, git | 4 |
| `architecture` | 架构设计 | 架构, 设计, architecture | 6 |

### 技能匹配算法

```
1. 将用户输入转小写
2. 遍历所有技能的 triggers 数组
3. 计算置信度：0.5 + matchedTriggers.length * 0.2（上限 1.0）
4. 按置信度降序排列，返回前 3 个
```

---

## 5. 督导系统（Supervisor）

规则引擎，检查 Agent 输出的代码质量。

### 规则类型

| 规则 | 说明 | 严重程度 |
|------|------|---------|
| `no-hardcoded-secrets` | 检测硬编码密钥 | error |
| `no-dangerous-commands` | 检测危险命令 | error |
| `max-file-length` | 文件行数上限 | warning |
| `no-console-in-prod` | 生产代码无 console | warning |

### 配置

```typescript
// MimoConfig 中无独立配置，通过 IPC 控制
window.api.supervisor.getViolations()
window.api.supervisor.setEnabled(true/false)
```

---

## 6. LLM 客户端 (`engine/src/llm/`)

### 配置

```typescript
interface LLMClientConfig {
  apiKey: string;
  baseUrl: string;       // "https://api.xiaomimimo.com/v1"
  model: string;         // "mimo-v2.5-pro"
  maxTokens: number;     // 4096
  temperature: number;   // 0.2
  timeout: number;       // 60000ms
  reasoningEffort?: 'low' | 'medium' | 'high';
}
```

### 流式处理

- 使用 `stream_options: { include_usage: true }` 获取 token 统计
- `StreamCollector` 组装 delta，`ToolCallAssembler` 缓存 argumentsDelta
- 最后一个 chunk（choices=[]，usage 在顶层）优先检查 usage

### Token 估算（`engine/src/llm/tokenizer.ts`）

```
CJK:      1.5 token/char
Hangul:   0.8 token/char
ASCII:    0.25 token/char + 1 per word
Symbol:   1.0 token/char
Space:    0.2 token/char
```

### 重试策略（`engine/src/llm/retry.ts`）

指数退避，默认 3 次重试，初始延迟 1s。

---

## 7. 上下文管理

### System Prompt 构建

`buildSystemPrompt(config, memory, cwd)` 动态生成，包含：

1. 身份定义（"You are MimoAgent..."）
2. 环境信息（工作目录、平台、Git 状态、日期）
3. 项目文件树（顶层）
4. 项目记忆（`.mimo-agent/memory.md`）
5. 项目上下文文件（`MIMO.md`, `.mimo-rules`, `CLAUDE.md`）
6. 编码规范
7. 工具使用策略
8. 权限模式说明
9. 用户追加（`systemPromptAppend`）

### 上下文压缩

当 token 超过 `contextWindow * 0.7` 时自动压缩：

| 级别 | 触发条件 | 策略 |
|------|---------|------|
| 轻度 | <70% | 移除早期工具结果，保留 60% 消息 |
| 中度 | 70-85% | 移除半数历史 |
| 重度 | >85% | 只保留最近 2 轮 |

---

## 8. 权限系统

### 风险等级

| 等级 | 工具 | 行为 |
|------|------|------|
| `read` | read_file, grep, glob, git_status, task_* | 自动允许 |
| `write` | write_file, edit_file, git_commit | 需确认（suggest）或自动（full-auto） |
| `execute` | shell, sub_agents_run | 需确认或自动 |
| `destructive` | 特定 shell 命令 | 始终需确认 |

### 路径权限规则

```typescript
// 内置规则
{ pattern: '**/.env*', actions: ['write', 'edit', 'shell'], policy: 'confirm' }
{ pattern: '**/.git/**', actions: ['*'], policy: 'deny' }
{ pattern: '**/node_modules/**', actions: ['*'], policy: 'deny' }
```

### 权限模式

| 模式 | 说明 |
|------|------|
| `suggest` | 所有写操作需确认 |
| `auto-edit` | 文件操作自动允许，shell 需确认 |
| `full-auto` | 除 destructive 外全部自动允许 |

---

## 9. IPC 通信

### 通道分组

| 域 | 通道 | 方向 |
|----|------|------|
| Agent | `agent:run/stop/clear/token/tool-start/tool-result/done/error/thinking` | 双向 |
| Config | `config:get/set` | invoke |
| Workspace | `workspace:get/set/select` | invoke |
| Session | `session:list/create/switch/delete/rename` | invoke |
| Messages | `messages:save/load` | invoke |
| Files | `file:list/read/write/dialog` | invoke |
| Permission | `permission:request/response` | 双向 |
| Skills | `skills:list/match/activate` | invoke |
| Supervisor | `supervisor:get-violations/set-enabled` | invoke |
| System | `system:get-info` | invoke |

### AgentService 桥接

`src/main/agent-service.ts` 是 Electron 和引擎的桥梁：

1. 动态导入 `Agent` 类（`pathToFileURL` + `import()`）
2. 翻译 `AppConfig` → `MimoConfig`
3. 消费 `agent.run()` 的 AsyncGenerator，转发 LoopEvent 到渲染进程
4. 管理 `AbortController` 实现停止功能
5. 连接 `PermissionChecker` 到 Electron 原生对话框

---

## 10. 配置系统

### 配置合并顺序（深覆盖）

1. 内置默认值 (`engine/src/config/defaults.ts`)
2. 全局配置 `~/.mimo-agent/config.json`
3. 项目配置 `<workspace>/.mimo-agent/config.json`
4. 环境变量 `MIMO_*`
5. 编程传入参数

### 关键配置项

```typescript
{
  model: 'mimo-v2.5-pro',
  apiBase: 'https://api.xiaomimimo.com/v1',
  apiKey: '',
  maxTokens: 4096,
  temperature: 0.2,
  reasoningEffort: 'medium',
  contextWindow: 1_048_576,      // 1M tokens
  permissionMode: 'suggest',
  toolPreset: 'act',
  maxTurns: 50,
  stream: true,
  sandbox: { enabled: false },
  subAgents: { enabled: true, maxConcurrent: 3, maxTurns: 10 },
}
```

---

## 11. 扩展指南

### 添加新工具

```typescript
// 1. 继承 BaseTool
import { BaseTool } from '../base.js';

export class MyTool extends BaseTool {
  name = 'my_tool';
  description = 'Does something useful';
  riskLevel = 'read';
  categories = ['file'];
  parameters = {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input value' },
    },
    required: ['input'],
  };

  async execute(args: { input: string }, context: ToolContext) {
    return { output: `Processed: ${args.input}`, isError: false };
  }
}

// 2. 注册到 builtin/index.ts
registry.register(new MyTool());
```

### 添加新技能

```typescript
// engine/src/skills/builtin/index.ts
{
  id: 'my-skill',
  name: '我的技能',
  description: '技能描述',
  triggers: ['关键词1', 'keyword2'],
  icon: 'MyIcon',
  priority: 5,
}
```

### 添加新子 Agent

```typescript
// engine/src/sub-agents/index.ts
export const SUB_AGENTS: Record<string, SubAgentDef> = {
  // ... 现有子 Agent
  my_agent: {
    name: 'My Agent',
    systemPrompt: 'You are a specialized agent for...',
    tools: ['read_file', 'grep', 'glob'],
    maxTurns: 5,
  },
};
```

### 添加 Hook

```typescript
agent.setHooks({
  beforeTool: async (name, args) => {
    if (name === 'shell' && args.command.includes('rm -rf')) {
      return { skip: true };  // 跳过危险命令
    }
  },
  afterTool: async (name, result) => {
    if (name === 'write_file' && !result.isError) {
      console.log(`File written successfully`);
    }
  },
});
```

---

## 12. 测试

```bash
# 全部测试（324 个）
npm test

# 分模块
npm run test:engine     # 281 个
npm run test:main       # 3 个
npm run test:renderer   # 40 个

# 类型检查
npm run typecheck

# Lint
npm run lint
```

### 测试覆盖率

| 模块 | 测试文件 | 用例数 |
|------|---------|--------|
| 权限检查 | `checker.test.ts` | 17 |
| 使用量追踪 | `usage-tracker.test.ts` | 19 |
| 文件缓存 | `file-cache.test.ts` | 15 |
| 项目记忆 | `memory.test.ts` | 12 |
| LLM 客户端 | `client.test.ts` | 8 |
| 流式处理 | `streaming.test.ts` | 19 |
| 输出校验 | `validator.test.ts` | 22 |
| Shell 工具 | `shell.test.ts` | 24 |
| 文件工具 | `read/write/edit-file.test.ts` | 52 |
| 搜索工具 | `glob/grep.test.ts` | 32 |
| 网页抓取 | `web-fetch.test.ts` | 24 |
| Agent 循环 | `agent-loop.test.ts` | 8 |

---

## 13. 构建和发布

```bash
# 开发模式
npm run start:dev

# 清理 + 构建
npm run clean
npm run build

# 打包 Windows
npx electron-builder --win --publish never

# CI/CD
# push tag v* 触发 GitHub Actions Release
# 自动执行: Lint → Typecheck → Test → Build → Package → Create Release
```

---

## 14. 相关资源

| 资源 | 位置 |
|------|------|
| Agent Harness | `E:\claudecodeuse\项目单独skill\Mimo\agent\` |
| Taste Skill 设计技能 | `E:\claudecodeuse\项目单独skill\Mimo\taste-skill\` |
| 生态系统文档 | `E:\claudecodeuse\项目单独skill\Mimo\AGENTS.md` |
| 项目总结 | `E:\claudecodeuse\项目总结\Mimo-agent.md` |
| 开发规范 | `E:\claudecodeuse\项目总结\开发规范.md` |
| 发布说明 | `E:\claudecodeuse\项目总结\MImo开发文档\v0.3.0发布说明.md` |
| GitHub | https://github.com/XWJDream/MimoAgent |

---

*最后更新：2026-06-08 | 版本：v0.3.0*

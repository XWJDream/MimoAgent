# 贡献指南

感谢你对 MimoAgent 的关注！本指南将帮助你参与项目开发。

## 目录

- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [代码风格指南](#代码风格指南)
- [Commit 规范](#commit-规范)
- [Pull Request 流程](#pull-request-流程)
- [测试要求](#测试要求)
- [问题报告指南](#问题报告指南)
- [分支策略](#分支策略)
- [安全问题](#安全问题)
- [许可证](#许可证)

## 开发环境设置

### 前置要求

- **Node.js** >= 18.0.0
- **npm** >= 9
- **Git**

### 安装步骤

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/你的用户名/mimo-desktop.git
cd mimo-desktop

# 2. 安装主项目依赖
npm install

# 3. 安装引擎依赖
cd engine && npm install && cd ..

# 4. 配置环境变量
cp .env.example .env
```

编辑 `.env` 文件，填入必要的配置：

```env
MIMO_API_KEY=your_api_key_here
MIMO_API_BASE=https://api.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5-pro
MIMO_PERMISSION_MODE=suggest
MIMO_MAX_TURNS=50
```

### 常用命令

```bash
# 开发模式启动
npm run start:dev

# 代码检查
npm run lint

# TypeScript 类型检查
npm run typecheck

# 运行测试
npm run test

# 构建项目
npm run build

# 打包应用 (Windows)
npm run package:win
```

## 项目结构

```
mimo-desktop/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 安全桥接层
│   ├── renderer/       # React UI (使用 Tailwind CSS)
│   └── shared/         # 共享类型定义
├── engine/             # Agent 引擎
│   └── src/
│       ├── core/       # Agent 循环逻辑
│       ├── tools/      # 内置工具
│       ├── permissions/# 权限系统
│       ├── context/    # 上下文管理
│       └── sandbox/    # 沙盒执行
├── resources/          # 图标资源
├── scripts/            # 开发脚本
└── release/            # 打包输出目录
```

## 代码风格指南

### TypeScript 配置

项目使用 TypeScript 严格模式，主要配置：

- **Target**: ES2023
- **Module**: ESNext
- **Strict**: true
- **JSX**: react-jsx

### ESLint 规则

项目使用 ESLint 9 的 flat config 格式 (`eslint.config.js`)，主要规则：

| 规则 | 级别 | 说明 |
|------|------|------|
| `@typescript-eslint/no-unused-vars` | warn | 未使用变量警告，允许 `_` 前缀参数 |
| `@typescript-eslint/no-explicit-any` | warn | 避免使用 `any` 类型 |
| `@typescript-eslint/no-non-null-assertion` | warn | 谨慎使用非空断言 |
| `no-console` | warn | 限制 console 使用，仅允许 `warn`, `error`, `debug` |

### 代码检查命令

```bash
# 检查主项目代码
npm run lint

# 类型检查 (所有模块)
npm run typecheck

# 单独检查各模块
npm run typecheck:engine
npm run typecheck:main
npm run typecheck:preload
npm run typecheck:renderer
```

### 命名规范

- **文件名**: 使用 kebab-case (如 `agent-loop.ts`)
- **组件名**: 使用 PascalCase (如 `ChatMessage.tsx`)
- **变量/函数**: 使用 camelCase
- **常量**: 使用 UPPER_SNAKE_CASE
- **类型/接口**: 使用 PascalCase，接口以 `I` 前缀可选

### 代码风格

- 使用 2 空格缩进
- 使用单引号字符串
- 语句末尾使用分号
- 保持代码简洁，添加必要的注释
- 遵循现有代码的注释密度

## Commit 规范

项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### Commit 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Type 类型

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档变更 |
| `style` | 代码格式调整 (不影响功能) |
| `refactor` | 重构 (既非新功能也非修复) |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `build` | 构建系统或外部依赖变更 |
| `ci` | CI 配置变更 |
| `chore` | 其他杂项变更 |
| `revert` | 回滚提交 |

### Scope 范围 (可选)

- `engine` - Agent 引擎
- `ui` - 用户界面
- `main` - Electron 主进程
- `preload` - 预加载脚本
- `tools` - 工具系统
- `permissions` - 权限系统

### 示例

```bash
# 简单提交
git commit -m "feat: 添加文件搜索工具"

# 带范围
git commit -m "fix(engine): 修复 Agent 循环中的内存泄漏"

# 带详细说明
git commit -m "feat(ui): 添加暗色主题支持

- 实现主题切换功能
- 添加主题持久化存储
- 更新所有组件样式

Closes #123"
```

## Pull Request 流程

### 1. 准备工作

```bash
# 确保基于最新的 dev 分支
git checkout dev
git pull origin dev

# 创建功能分支
git checkout -b feature/your-feature-name
```

### 2. 开发与测试

```bash
# 进行开发...

# 运行代码检查
npm run lint

# 运行类型检查
npm run typecheck

# 运行测试
npm run test

# 确保构建成功
npm run build
```

### 3. 提交代码

```bash
git add .
git commit -m "feat: 你的功能描述"
git push origin feature/your-feature-name
```

### 4. 创建 Pull Request

1. 访问 GitHub 仓库页面
2. 点击 **New Pull Request**
3. 选择目标分支为 `dev`
4. 填写 PR 模板：
   - **标题**: 简洁描述变更
   - **描述**: 详细说明变更内容、原因和影响
   - **关联 Issue**: 使用 `Closes #issue_number`

### 5. 代码审查

- 等待维护者审查
- 根据反馈进行修改
- 保持 PR 更新并与审查者沟通

### PR 检查清单

提交 PR 前，请确认：

- [ ] 代码通过 `npm run lint` 检查
- [ ] 代码通过 `npm run typecheck` 检查
- [ ] 所有测试通过 `npm run test`
- [ ] 项目可以成功构建 `npm run build`
- [ ] Commit 信息符合规范
- [ ] 已添加必要的测试
- [ ] 已更新相关文档 (如有必要)

## 测试要求

### 测试框架

项目使用 [Vitest](https://vitest.dev/) 作为测试框架。

### 测试命令

```bash
# 运行所有测试
npm run test

# 运行引擎测试
npm run test:engine

# 运行主进程测试
npm run test:main

# 运行渲染进程测试
npm run test:renderer

# 运行集成测试 (需要 API 密钥)
npm run test:live
```

### 测试文件位置

- 引擎测试: `engine/src/**/*.test.ts`
- 主进程测试: `src/main/**/*.test.ts`
- 渲染进程测试: `src/renderer/**/*.test.tsx`

### 编写测试

```typescript
import { describe, it, expect } from 'vitest';

describe('功能名称', () => {
  it('应该正确处理正常输入', () => {
    const result = yourFunction('input');
    expect(result).toBe('expected');
  });

  it('应该处理错误情况', () => {
    expect(() => yourFunction(null)).toThrow();
  });
});
```

### 测试覆盖率

- 新功能必须包含测试
- Bug 修复必须包含回归测试
- 优先测试核心逻辑和边界情况

## 问题报告指南

### 报告 Bug

1. 在 [Issues](https://github.com/XWJDream/mimo-desktop/issues) 页面搜索是否已有相同问题
2. 如果没有，点击 **New Issue** 创建
3. 使用 **Bug Report** 模板

### Bug 报告内容

请包含以下信息：

- **环境信息**
  - 操作系统及版本
  - Node.js 版本
  - npm 版本
  - 应用版本

- **问题描述**
  - 清晰简洁地描述问题
  - 预期行为 vs 实际行为

- **复现步骤**
  1. 第一步
  2. 第二步
  3. ...

- **错误日志**
  - 控制台输出
  - 错误截图
  - 相关日志文件

### 提交功能建议

1. 在 Issues 中创建
2. 使用 **Feature Request** 模板
3. 说明：
   - 使用场景
   - 期望的行为
   - 可能的实现方案 (可选)

## 分支策略

| 分支 | 用途 | 说明 |
|------|------|------|
| `master` | 稳定发布版 | 仅用于合并发版，不直接提交 |
| `dev` | 开发分支 | PR 的目标分支，日常开发基础 |
| `feature/*` | 功能分支 | 从 `dev` 创建，完成后合并回 `dev` |
| `fix/*` | 修复分支 | 从 `dev` 创建，用于 Bug 修复 |
| `release/*` | 发布分支 | 从 `dev` 创建，用于版本发布准备 |

**所有 PR 请提交到 `dev` 分支。**

## 安全问题

如果发现安全漏洞，请**不要**在公开 Issue 中报告。

请通过以下方式联系维护者：
- 发送邮件至项目维护者
- 使用 GitHub 的私密漏洞报告功能

## 许可证

提交代码即表示你同意你的贡献以 [MIT License](LICENSE) 发布。

## 获取帮助

- 查看 [Issues](https://github.com/XWJDream/mimo-desktop/issues) 获取已知问题
- 在 [Discussions](https://github.com/XWJDream/mimo-desktop/discussions) 中提问
- 阅读项目文档了解更多细节

---

感谢你的贡献！每一个改进都让 MimoAgent 变得更好。

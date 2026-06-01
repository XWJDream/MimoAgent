# 贡献指南

感谢你对 MimoAgent 的关注！以下是参与贡献的方式。

## 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/XWJDream/MimoAgent/issues) 页面搜索是否已有相同问题
2. 如果没有，点击 **New Issue** 创建，使用 Bug Report 模板
3. 请包含：操作系统、Node.js 版本、复现步骤、错误截图

### 提交功能建议

1. 在 Issues 中创建，使用 Feature Request 模板
2. 说明使用场景和期望的行为

### 提交代码

1. Fork 本仓库
2. 基于 `dev` 分支创建你的分支：`git checkout -b feature/your-feature dev`
3. 提交代码并推送到你的 Fork
4. 创建 Pull Request，目标分支选择 `dev`

## 开发环境

```bash
# 前置要求
# - Node.js >= 18
# - npm >= 9
# - Git

# 1. Fork 并克隆
git clone https://github.com/你的用户名/MimoAgent.git
cd MimoAgent

# 2. 安装依赖
npm install
cd engine && npm install && cd ..

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 MIMO_API_KEY

# 4. 启动开发模式
npm run start:dev
```

## 项目结构

```
MimoAgent/
├── src/
│   ├── main/           # Electron 主进程
│   ├── preload/        # 安全桥接层
│   ├── renderer/       # React UI
│   └── shared/         # 共享类型
├── engine/             # Agent 引擎
│   └── src/
│       ├── core/       # Agent 循环
│       ├── tools/      # 内置工具
│       ├── permissions/# 权限系统
│       ├── context/    # 上下文管理
│       └── sandbox/    # 沙盒执行
├── resources/          # 图标资源
└── scripts/            # 开发脚本
```

## 代码规范

- 使用 TypeScript 严格模式
- 遵循现有代码风格（命名、缩进、注释密度）
- 提交前运行 `npm run build` 确保编译通过
- 提交信息使用英文，格式：`type: description`
  - `feat:` 新功能
  - `fix:` 修复 Bug
  - `docs:` 文档变更
  - `refactor:` 重构
  - `perf:` 性能优化
  - `test:` 测试相关
  - `chore:` 构建/工具变更

## 分支策略

| 分支 | 用途 |
|------|------|
| `dev` | 开发分支，PR 的目标分支 |
| `master` | 稳定发布版，仅用于合并发版 |

**所有 PR 请提交到 `dev` 分支。**

## 安全问题

如果发现安全漏洞，请**不要**在公开 Issue 中报告。请发邮件至项目维护者。

## 许可证

提交代码即表示你同意你的贡献以 [MIT License](LICENSE) 发布。

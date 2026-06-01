# Changelog

## v0.2.0 (2026-06-01)

### 🚀 新功能

**智能 Agent 架构**
- 智能 System Prompt — 自动注入环境信息、项目文件树、编码规范、工具策略
- 上下文压缩 — 对话超长时自动调用 LLM 生成结构化摘要
- Hook 系统 — beforeTool/afterTool 钩子，支持工具执行拦截和修改
- 循环检测 — Agent 重复调用相同工具时自动停止
- Summarizer 子 Agent — 专用摘要 Agent

**工具增强**
- 工具预设模式 — plan（只读分析）/ act（完整操作）切换
- Web 抓取工具 — Agent 可直接访问网页查文档
- Git Checkpoint — 写文件前创建 stash 检查点，支持回滚
- Diff 预览 — edit/write 后自动显示变更差异
- 新增 14 条危险命令拦截规则

**体验优化**
- 消息编辑 — 编辑历史消息并重新生成
- 重新生成 — 对不满意的回复一键重试
- 会话持久化 — 重启后自动恢复对话历史
- API 验证 — 启动时自动检测 Key 有效性
- 项目上下文文件 — 支持 MIMO.md / .mimo-rules 注入指令

**安全加固**
- 路径级权限 — .env 需确认，.git 禁止修改
- 沙盒模式 — Docker 隔离执行（可选）
- 修复 shell 注入漏洞（grep、git-commit、git-checkpoint、git-status）
- 移除 eval() 动态导入
- React ErrorBoundary 全局错误捕获
- 流式 token 批量渲染优化

### 🐛 修复

- CSP 策略补充 img-src / connect-src / media-src
- ES2023 target 升级（修复 findLastIndex 警告）
- JSON.parse 安全包装
- 移除硬编码的占位项目数据

## v0.1.0 (2026-05-30)

### 🎉 首次发布

- AI 对话 — 基于 MiMo v2.5 Pro 模型
- 代码工具 — 文件读写、Shell 执行、Git 操作
- MCP 插件 — Model Context Protocol 扩展
- 自动化规则 — 文件变更监听、定时任务
- TTS 语音合成 — 9 种音色、语速调节
- 文件浏览 — 内置文件树与代码预览
- 会话管理 — 多会话并行
- 权限控制 — 建议 / 自动编辑 / 全自动

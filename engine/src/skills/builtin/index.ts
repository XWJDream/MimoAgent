/**
 * Built-in skill definitions
 */
import type { SkillDefinition } from '../types.js';

export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    id: 'code-review',
    name: '代码审查',
    description: '审查代码质量、发现潜在问题、提供改进建议',
    triggers: ['审查', 'review', '检查代码', '代码质量', 'code review', 'look at'],
    requiredTools: ['read_file', 'grep', 'glob'],
    systemPromptAddon: '你正在执行代码审查任务。请关注：代码风格一致性、潜在 bug、性能问题、安全漏洞、可维护性。提供具体的改进建议和示例代码。',
    priority: 8,
    icon: 'Search',
  },
  {
    id: 'refactor',
    name: '代码重构',
    description: '优化代码结构、提高可读性和可维护性',
    triggers: ['重构', '优化', 'refactor', 'clean up', '整理代码', 'improve'],
    requiredTools: ['read_file', 'write_file', 'edit_file'],
    systemPromptAddon: '你正在执行代码重构任务。请遵循：单一职责原则、DRY 原则、保持函数简短、提取公共逻辑、改进命名。确保重构后功能不变。',
    priority: 7,
    icon: 'Shuffle',
  },
  {
    id: 'debug',
    name: '调试辅助',
    description: '帮助定位和修复 bug',
    triggers: ['调试', 'bug', '错误', 'debug', 'fix', '修复', '出错', '不工作', '异常'],
    requiredTools: ['read_file', 'grep', 'shell'],
    systemPromptAddon: '你正在执行调试任务。请：1) 理解问题现象 2) 定位问题根源 3) 分析可能原因 4) 提供修复方案 5) 验证修复效果。使用日志和断点辅助调试。',
    priority: 9,
    icon: 'Bug',
  },
  {
    id: 'test',
    name: '测试生成',
    description: '为代码生成单元测试和集成测试',
    triggers: ['测试', 'test', '单测', '单元测试', '集成测试', '写测试', '添加测试'],
    requiredTools: ['read_file', 'write_file', 'shell'],
    systemPromptAddon: '你正在执行测试生成任务。请：覆盖正常路径和边界情况、使用适当的测试框架、遵循 AAA 模式（Arrange-Act-Assert）、添加有意义的断言、确保测试可重复运行。',
    priority: 6,
    icon: 'TestTube',
  },
  {
    id: 'docs',
    name: '文档生成',
    description: '为代码生成文档和注释',
    triggers: ['文档', 'docs', '注释', 'documentation', 'readme', '说明文档', 'api文档'],
    requiredTools: ['read_file', 'write_file'],
    systemPromptAddon: '你正在执行文档生成任务。请：使用清晰简洁的语言、包含代码示例、说明参数和返回值、添加使用场景、保持文档与代码同步。',
    priority: 5,
    icon: 'FileText',
  },
  {
    id: 'git-workflow',
    name: 'Git 工作流',
    description: '辅助 Git 操作，如提交、分支管理等',
    triggers: ['提交', 'commit', '分支', 'branch', 'merge', '合并', 'git', '推送', 'push', '拉取', 'pull'],
    requiredTools: ['shell', 'git_status', 'git_commit'],
    systemPromptAddon: '你正在执行 Git 操作。请：使用清晰的 commit message、遵循 Conventional Commits 规范、在提交前检查变更、提供分支策略建议。',
    priority: 4,
    icon: 'GitBranch',
  },
  {
    id: 'architecture',
    name: '架构设计',
    description: '帮助设计系统架构和模块划分',
    triggers: ['架构', '设计', 'architecture', 'design', '模块划分', '系统设计', '技术方案'],
    requiredTools: ['read_file', 'glob', 'task_create'],
    systemPromptAddon: '你正在执行架构设计任务。请：分析现有代码结构、识别模块边界、设计清晰的接口、考虑可扩展性和可维护性、提供设计图和文档。',
    priority: 6,
    icon: 'Layout',
  },
];

/**
 * Register all built-in skills
 */
export function registerBuiltinSkills(registry: { register(skill: SkillDefinition): void }): void {
  for (const skill of BUILTIN_SKILLS) {
    registry.register(skill);
  }
}

/**
 * Skill system types for intelligent tool loading
 */

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  triggers: string[];           // 触发关键词
  requiredTools: string[];      // 需要的工具
  systemPromptAddon: string;    // 附加系统提示
  contextFiles?: string[];      // 相关上下文文件
  priority: number;             // 优先级 (越高越优先)
  icon?: string;                // 图标名称
}

export interface SkillMatchResult {
  skill: SkillDefinition;
  confidence: number;           // 匹配置信度 (0-1)
  matchedTriggers: string[];    // 匹配到的触发词
}

export interface SkillContext {
  workspace: string;
  activeFiles?: string[];
}

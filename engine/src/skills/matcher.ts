/**
 * Skill Matcher - intelligent skill matching based on user input and context
 */
import type { SkillDefinition, SkillMatchResult, SkillContext } from './types.js';

export interface MatcherOptions {
  maxSkills?: number;           // 最大返回技能数
  minConfidence?: number;       // 最小置信度阈值
  boostRecent?: boolean;        // 提升最近使用的技能
}

const DEFAULT_OPTIONS: MatcherOptions = {
  maxSkills: 3,
  minConfidence: 0.3,
  boostRecent: true,
};

/**
 * Analyze user input and match relevant skills
 */
export function matchSkills(
  input: string,
  skills: SkillDefinition[],
  _context?: SkillContext,
  options: MatcherOptions = {},
): SkillMatchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const normalizedInput = input.toLowerCase();
  const results: SkillMatchResult[] = [];

  // Extract keywords from input
  const keywords = extractKeywords(normalizedInput);

  for (const skill of skills) {
    const matchedTriggers: string[] = [];
    let maxConfidence = 0;

    // Check trigger matches
    for (const trigger of skill.triggers) {
      const normalizedTrigger = trigger.toLowerCase();

      // Exact match in input
      if (normalizedInput.includes(normalizedTrigger)) {
        matchedTriggers.push(trigger);
        maxConfidence = Math.max(maxConfidence, 1.0);
      }
      // Keyword match
      else if (keywords.some(kw => normalizedTrigger.includes(kw) || kw.includes(normalizedTrigger))) {
        matchedTriggers.push(trigger);
        maxConfidence = Math.max(maxConfidence, 0.7);
      }
      // Partial match
      else if (
        normalizedTrigger.includes(normalizedInput.substring(0, Math.min(6, normalizedInput.length))) ||
        normalizedInput.includes(normalizedTrigger.substring(0, Math.min(4, normalizedTrigger.length)))
      ) {
        matchedTriggers.push(trigger);
        maxConfidence = Math.max(maxConfidence, 0.4);
      }
    }

    if (matchedTriggers.length > 0 && maxConfidence >= (opts.minConfidence || 0.3)) {
      // Boost confidence based on number of matched triggers
      let confidence = Math.min(maxConfidence * (1 + matchedTriggers.length * 0.05), 1.0);

      // Boost based on priority
      confidence *= (0.5 + skill.priority / 20);

      results.push({
        skill,
        confidence: Math.min(confidence, 1.0),
        matchedTriggers,
      });
    }
  }

  // Sort by confidence
  results.sort((a, b) => b.confidence - a.confidence);

  // Return top N results
  return results.slice(0, opts.maxSkills);
}

/**
 * Extract keywords from input text
 */
function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
    'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
    'or', 'if', 'while', 'this', 'that', 'these', 'those', 'it', 'its',
  ]);

  // Split by common separators and filter
  const words = text
    .split(/[\s,，.。!！?？;；:：、\n\r\t]+/)
    .filter(w => w.length > 1 && !stopWords.has(w));

  return [...new Set(words)];
}

/**
 * Get the best skill for a given input
 */
export function matchBestSkill(
  input: string,
  skills: SkillDefinition[],
  context?: SkillContext,
): SkillMatchResult | null {
  const results = matchSkills(input, skills, context, { maxSkills: 1 });
  return results.length > 0 ? results[0] : null;
}

/**
 * Get combined system prompt addon for matched skills
 */
export function getSkillPromptAddon(matches: SkillMatchResult[]): string {
  if (matches.length === 0) return '';

  const addons = matches
    .map(m => `### ${m.skill.name}\n${m.skill.systemPromptAddon}`)
    .filter(Boolean);

  if (addons.length === 0) return '';

  return `\n\n## 智能技能加载\n以下技能已根据你的请求自动加载：\n\n${addons.join('\n\n')}`;
}

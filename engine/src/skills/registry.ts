/**
 * Skill Registry - manages skill definitions and matching
 */
import type { SkillDefinition, SkillMatchResult, SkillContext } from './types.js';

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  /**
   * Register a skill
   */
  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  /**
   * Register multiple skills
   */
  registerAll(skills: SkillDefinition[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Get a skill by ID
   */
  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  /**
   * Get all registered skills
   */
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Match skills based on user input
   */
  match(input: string, _context?: SkillContext): SkillMatchResult[] {
    const normalizedInput = input.toLowerCase();
    const results: SkillMatchResult[] = [];

    for (const skill of this.skills.values()) {
      const matchedTriggers: string[] = [];
      let maxConfidence = 0;

      for (const trigger of skill.triggers) {
        const normalizedTrigger = trigger.toLowerCase();

        // Exact match
        if (normalizedInput.includes(normalizedTrigger)) {
          matchedTriggers.push(trigger);
          maxConfidence = Math.max(maxConfidence, 1.0);
        }
        // Partial match (trigger is substring of input or vice versa)
        else if (
          normalizedTrigger.includes(normalizedInput) ||
          normalizedInput.includes(normalizedTrigger.substring(0, Math.min(4, normalizedTrigger.length)))
        ) {
          matchedTriggers.push(trigger);
          maxConfidence = Math.max(maxConfidence, 0.5);
        }
      }

      if (matchedTriggers.length > 0) {
        // Boost confidence based on number of matched triggers
        const confidence = Math.min(maxConfidence * (1 + matchedTriggers.length * 0.1), 1.0);

        results.push({
          skill,
          confidence,
          matchedTriggers,
        });
      }
    }

    // Sort by confidence * priority
    results.sort((a, b) =>
      (b.confidence * b.skill.priority) - (a.confidence * a.skill.priority)
    );

    return results;
  }

  /**
   * Get the best matching skill
   */
  matchBest(input: string, context?: SkillContext): SkillMatchResult | null {
    const results = this.match(input, context);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Get skills that require specific tools
   */
  getSkillsForTools(toolNames: string[]): SkillDefinition[] {
    return Array.from(this.skills.values()).filter(skill =>
      skill.requiredTools.some(tool => toolNames.includes(tool))
    );
  }

  /**
   * Get combined system prompt addon for matched skills
   */
  getSystemPromptAddon(skills: SkillDefinition[]): string {
    if (skills.length === 0) return '';

    const addons = skills
      .sort((a, b) => b.priority - a.priority)
      .map(s => s.systemPromptAddon)
      .filter(Boolean);

    if (addons.length === 0) return '';

    return `\n\n## Active Skills\n${addons.join('\n\n')}`;
  }
}

/**
 * Supervisor Manager - monitors agent actions and provides oversight
 */
import type { SupervisorRule, SupervisorContext, SupervisorResult, SupervisorEvent } from './types.js';

export class SupervisorManager {
  private rules = new Map<string, SupervisorRule>();
  private events: SupervisorEvent[] = [];
  private listeners: Array<(event: SupervisorEvent) => void> = [];

  /**
   * Register a supervisor rule
   */
  registerRule(rule: SupervisorRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Register multiple rules
   */
  registerRules(rules: SupervisorRule[]): void {
    for (const rule of rules) {
      this.registerRule(rule);
    }
  }

  /**
   * Get all registered rules
   */
  getRules(): SupervisorRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Add an event listener
   */
  onEvent(listener: (event: SupervisorEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Check a tool execution against all rules
   */
  check(context: SupervisorContext): SupervisorResult[] {
    const results: SupervisorResult[] = [];

    for (const rule of this.rules.values()) {
      try {
        const result = rule.check(context);
        if (result) {
          results.push(result);

          // Emit event
          const event: SupervisorEvent = {
            type: 'violation',
            result,
            timestamp: Date.now(),
          };
          this.events.push(event);
          this.listeners.forEach(listener => listener(event));
        }
      } catch (err) {
        console.error(`[Supervisor] Rule ${rule.id} failed:`, err);
      }
    }

    return results;
  }

  /**
   * Get recent events
   */
  getEvents(limit: number = 50): SupervisorEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clear events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get violation count by severity
   */
  getViolationCounts(): Record<string, number> {
    const counts: Record<string, number> = { info: 0, warning: 0, error: 0 };
    for (const event of this.events) {
      counts[event.result.severity]++;
    }
    return counts;
  }
}

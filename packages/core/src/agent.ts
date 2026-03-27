import type { AgentDefinition, AgentRunFn } from "./types.ts";

/**
 * Agent — A single agent in the pipeline.
 *
 * An agent is defined by:
 *  - name / role
 *  - a system prompt
 *  - a `run(ctx, chat)` function that does the work
 *  - an optional preferred model
 *
 * @example
 * const myAgent = Agent.create({
 *   name: 'Reviewer',
 *   role: 'reviewer',
 *   model: 'claude-opus-4-20250514',
 *   systemPrompt: 'You review code for quality...',
 *   run: async (ctx, chat) => {
 *     const review = await chat([{ role: 'user', content: String(ctx.get('code')) }]);
 *     ctx.set('review', review);
 *     return { success: true, output: review };
 *   },
 * });
 */
export class Agent {
  readonly name: string;
  readonly role: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly run: AgentRunFn;

  constructor(def: AgentDefinition) {
    this.name = def.name;
    this.role = def.role;
    this.model = def.model ?? "";
    this.systemPrompt = def.systemPrompt;
    this.run = def.run;
  }

  /** Shorthand factory. */
  static create(def: AgentDefinition): Agent {
    return new Agent(def);
  }

  toJSON(): { name: string; role: string; model: string } {
    return { name: this.name, role: this.role, model: this.model };
  }
}

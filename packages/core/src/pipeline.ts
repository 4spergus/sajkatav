import EventEmitter from 'eventemitter3';
import { Context } from './context.js';
import type { Agent } from './agent.js';
import type {
  ChatFn,
  Message,
  ModelOptions,
  PipelineEvents,
  Provider,
  StepResult,
} from './types.js';

interface PipelineOptions {
  name?: string;
  agents: Agent[];
  provider: Provider;
  continueOnError?: boolean;
  retries?: number;
}

/**
 * Pipeline — Runs a sequence of Agents over a shared Context.
 *
 * The pipeline:
 *  1. Creates a Context from the user's prompt
 *  2. For each agent, builds a `chat()` function bound to the agent's model + system prompt
 *  3. Calls `agent.run(ctx, chat)` for each step
 *  4. Emits events for progress tracking
 *
 * @example
 * const pipeline = Pipeline.create({
 *   provider,
 *   agents: [agents.orchestrator(), agents.specGenerator(), agents.coder(), agents.tester()],
 * });
 *
 * pipeline.on('agent:start', ({ name }) => console.log(`Running: ${name}`));
 * const ctx = await pipeline.run('Build a REST API');
 */
export class Pipeline extends EventEmitter<PipelineEvents> {
  readonly name: string;
  readonly agents: readonly Agent[];
  readonly provider: Provider;
  readonly options: { continueOnError: boolean; retries: number };

  constructor({
    name = 'agentic-pipeline',
    agents,
    provider,
    continueOnError = false,
    retries = 1,
  }: PipelineOptions) {
    super();
    this.name = name;
    this.agents = agents;
    this.provider = provider;
    this.options = { continueOnError, retries };
  }

  /** Shorthand factory. */
  static create(cfg: PipelineOptions): Pipeline {
    return new Pipeline(cfg);
  }

  /**
   * Run the pipeline.
   */
  async run(
    input: string | { request: string; workDir?: string },
  ): Promise<Context> {
    const request = typeof input === 'string' ? input : input.request;
    const workDir =
      typeof input === 'object' ? input.workDir : undefined;

    const ctx = new Context({ request, workDir });

    this.emit('start', { pipeline: this.name, request });

    for (const agent of this.agents) {
      this.emit('agent:start', { name: agent.name, role: agent.role });

      const chat = this.#makeChatFn(agent);

      let result: StepResult | undefined;
      let lastErr: Error | undefined;

      for (let attempt = 1; attempt <= this.options.retries; attempt++) {
        try {
          ctx.log(agent.name, `Starting (attempt ${attempt})`);
          result = await agent.run(ctx, chat);
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error(String(err));
          ctx.log(agent.name, `Error (attempt ${attempt}): ${lastErr.message}`);
          if (attempt < this.options.retries) {
            await sleep(1000 * attempt);
          }
        }
      }

      if (!result) {
        result = {
          success: false,
          output: lastErr?.message ?? 'Unknown error',
        };
      }

      if (result.success) {
        ctx.log(agent.name, 'Completed');
        this.emit('agent:done', { name: agent.name, result });
      } else {
        ctx.log(agent.name, `Failed: ${result.output}`);
        this.emit('agent:error', { name: agent.name, result });

        if (!this.options.continueOnError) {
          this.emit('error', { agent: agent.name, result, ctx });
          return ctx;
        }
      }
    }

    this.emit('done', { ctx });
    return ctx;
  }

  /**
   * Build a `chat(messages, opts?)` function scoped to a specific agent.
   * Injects the system prompt and routes to the provider.
   */
  #makeChatFn(agent: Agent): ChatFn {
    const provider = this.provider;

    return async (messages: Message[], opts: ModelOptions = {}): Promise<string> => {
      const allMessages: Message[] = agent.systemPrompt
        ? [{ role: 'system' as const, content: agent.systemPrompt }, ...messages]
        : messages;

      return provider.chat(allMessages, {
        model: agent.model || undefined,
        ...opts,
      });
    };
  }

  /** Describe the pipeline (for logging / dry-run). */
  describe(): { name: string; agents: ReturnType<Agent['toJSON']>[] } {
    return {
      name: this.name,
      agents: this.agents.map((a) => a.toJSON()),
    };
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => { setTimeout(r, ms); });

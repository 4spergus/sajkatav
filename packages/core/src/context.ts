import type { LogEntry } from './types.js';

/**
 * Context — The shared blackboard that flows through all pipeline agents.
 *
 * Each agent reads from context and writes its results back.
 * Uses a simple key-value store plus typed accessors for common fields.
 *
 * @example
 * ctx.set('plan', { ... });
 * ctx.get<Plan>('plan');
 * ctx.request;
 * ctx.log('Coder', 'Done');
 */
export class Context {
  readonly request: string;
  readonly workDir: string;
  readonly #store = new Map<string, unknown>();
  readonly timeline: LogEntry[] = [];
  readonly files: string[] = [];

  constructor(init: { request: string; workDir?: string }) {
    this.request = init.request;
    this.workDir = init.workDir ?? process.cwd();
  }

  /** Get a value by key with type narrowing. */
  get<T = unknown>(key: string): T | undefined {
    return this.#store.get(key) as T | undefined;
  }

  /** Set a value by key. */
  set(key: string, value: unknown): this {
    this.#store.set(key, value);
    return this;
  }

  /** Check if key exists. */
  has(key: string): boolean {
    return this.#store.has(key);
  }

  /** Add a file artifact. */
  addFile(path: string): this {
    if (!this.files.includes(path)) this.files.push(path);
    return this;
  }

  /** Append a log entry. */
  log(agent: string, message: string, data?: unknown): void {
    this.timeline.push({ agent, message, data, time: new Date() });
  }

  /** Snapshot for serialization. */
  toJSON(): {
    request: string;
    workDir: string;
    store: Record<string, unknown>;
    files: string[];
    timeline: LogEntry[];
  } {
    return {
      request: this.request,
      workDir: this.workDir,
      store: Object.fromEntries(this.#store),
      files: this.files,
      timeline: this.timeline,
    };
  }
}

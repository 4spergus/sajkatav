/**
 * @file Type definitions for the pipeline library.
 */

// ── Provider ─────────────────────────────────────────────────────

/** A model provider (e.g. Copilot). */
export interface Provider {
  /** Provider identifier (e.g. 'copilot'). */
  readonly name: string;

  /** Send messages and get a full response. */
  chat(messages: Message[], opts?: ModelOptions): Promise<string>;

  /** Stream a response, calling onChunk for each piece. */
  chatStream?(
    messages: Message[],
    onChunk: (text: string) => void,
    opts?: ModelOptions,
  ): Promise<string>;
}

// ── Messages ─────────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelOptions {
  /** Override the model for this call. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

// ── Agent ────────────────────────────────────────────────────────

/** Definition used to create an Agent. */
export interface AgentDefinition {
  /** Display name (e.g. 'Orchestrator'). */
  name: string;
  /** Unique role key (e.g. 'orchestrator'). */
  role: string;
  /** Preferred model family. */
  model?: string;
  /** System instructions for this agent. */
  systemPrompt: string;
  /** The work function. */
  run: AgentRunFn;
}

/** The function signature for an agent's `run()`. */
export type AgentRunFn = (
  ctx: import("./context.ts").Context,
  chat: ChatFn,
) => Promise<StepResult>;

/** A chat function bound to an agent's model + system prompt. */
export type ChatFn = (
  messages: Message[],
  opts?: ModelOptions,
) => Promise<string>;

// ── Step result ──────────────────────────────────────────────────

export interface StepResult {
  success: boolean;
  /** Human-readable summary. */
  output?: string;
  /** Structured data stored on context. */
  data?: unknown;
  /** File paths produced. */
  files?: string[];
}

// ── Pipeline config ──────────────────────────────────────────────

export interface PipelineConfig {
  name?: string;
  agents: AgentDefinition[];
  provider: Provider;
  continueOnError?: boolean;
  retries?: number;
}

// ── Config shape ─────────────────────────────────────────────────

export interface AppConfig {
  name: string;
  continueOnError: boolean;
  retries: number;
  models: ModelConfig;
  tester: TesterConfig;
}

export interface ModelConfig {
  orchestrator: string;
  specGenerator: string;
  coder: string;
  tester: string;
}

export interface TesterConfig {
  framework: string;
}

// ── Utility ──────────────────────────────────────────────────────

/** Make all properties optional, deeply. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// ── Log entry ────────────────────────────────────────────────────

export interface LogEntry {
  agent: string;
  message: string;
  data?: unknown;
  time: Date;
}

// ── Pipeline events ──────────────────────────────────────────────

export interface PipelineEvents {
  start: (data: { pipeline: string; request: string }) => void;
  "agent:start": (data: { name: string; role: string }) => void;
  "agent:done": (data: { name: string; result: StepResult }) => void;
  "agent:error": (data: { name: string; result: StepResult }) => void;
  done: (data: { ctx: import("./context.ts").Context }) => void;
  error: (data: {
    agent: string;
    result: StepResult;
    ctx: import("./context.ts").Context;
  }) => void;
}

// ── Agent factory options ────────────────────────────────────────

export interface AgentFactoryOptions {
  model?: string;
  systemPrompt?: string;
}

export interface TesterFactoryOptions extends AgentFactoryOptions {
  framework?: string;
}

// ── Parsed output shapes ─────────────────────────────────────────

export interface PlanStep {
  id: number;
  description: string;
  files: string[];
  details: string;
}

export interface Plan {
  summary: string;
  architecture?: string;
  steps: PlanStep[];
  dependencies?: string[];
  testStrategy?: {
    framework: string;
    files: string[];
    coverage: string[];
  };
}

export interface RawPlan {
  summary: string;
  steps: never[];
  raw: true;
}

export interface SpecFunction {
  name: string;
  params: Array<{ name: string; type: string; description: string }>;
  returns: string;
  description: string;
  errorHandling?: string;
}

export interface SpecFile {
  path: string;
  purpose: string;
  exports: string[];
  functions: SpecFunction[];
  dependencies: string[];
}

export interface Spec {
  files: SpecFile[];
  dataFlow?: string;
  errorStrategy?: string;
}

export interface RawSpec {
  files: never[];
  raw: string;
}

export interface CodeFile {
  path: string;
  content: string;
  description?: string;
}

export interface CodeOutput {
  files: CodeFile[];
  dependencies?: string[];
  summary?: string;
}

export interface RawCodeOutput {
  files: never[];
  raw: string;
}

export interface TestFile {
  path: string;
  content: string;
  description?: string;
  testCount?: number;
}

export interface TestOutput {
  files: TestFile[];
  coverage?: string[];
  setupInstructions?: string;
}

export interface RawTestOutput {
  files: never[];
  raw: string;
}

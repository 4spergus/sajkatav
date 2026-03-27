/**
 * @anthropic-ai/agentic-pipeline
 *
 * A configurable agentic pipeline library.
 * All model access goes through a Provider interface — in practice, Copilot.
 *
 * Default pipeline: Orchestrator → Spec Generator → Coder → Tester
 * Fully configurable: add, remove, reorder, or replace any agent.
 *
 * @example
 * import { Pipeline, agents } from '@anthropic-ai/agentic-pipeline';
 *
 * const pipeline = Pipeline.create({
 *   provider,  // A CopilotProvider instance
 *   agents: [agents.orchestrator(), agents.specGenerator(), agents.coder(), agents.tester()],
 * });
 *
 * const result = await pipeline.run('Build a REST API');
 */

// ── Core ──
export { Pipeline } from './pipeline.js';
export { Agent } from './agent.js';
export { Context } from './context.js';

// ── Built-in agents (as factory functions) ──
export * as agents from './agents/index.js';

// ── Config helpers ──
export { defineConfig, defaultConfig } from './config.js';

// ── Types ──
export type {
  Provider,
  Message,
  ModelOptions,
  AgentDefinition,
  AgentRunFn,
  ChatFn,
  StepResult,
  PipelineConfig,
  PipelineEvents,
  AppConfig,
  ModelConfig,
  TesterConfig,
  DeepPartial,
  LogEntry,
  AgentFactoryOptions,
  TesterFactoryOptions,
  Plan,
  PlanStep,
  RawPlan,
  Spec,
  SpecFile,
  SpecFunction,
  RawSpec,
  CodeFile,
  CodeOutput,
  RawCodeOutput,
  TestFile,
  TestOutput,
  RawTestOutput,
} from './types.js';

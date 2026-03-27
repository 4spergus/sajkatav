import { Agent } from '../agent.js';
import type {
  AgentFactoryOptions,
  Plan,
  Spec,
  RawSpec,
  StepResult,
} from '../types.js';

/**
 * Spec Generator agent — turns a plan into detailed technical specifications.
 *
 * Reads `plan` from context, writes `spec` to context.
 */
export function specGenerator(opts: AgentFactoryOptions = {}): Agent {
  return Agent.create({
    name: 'Spec Generator',
    role: 'spec-generator',
    model: opts.model ?? 'claude-sonnet-4-20250514',
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,

    async run(ctx, chat): Promise<StepResult> {
      const plan = ctx.get<Plan>('plan');
      if (!plan) {
        return {
          success: false,
          output: 'No plan found. Run Orchestrator first.',
        };
      }

      const response = await chat([
        { role: 'user', content: buildPrompt(ctx.request, plan) },
      ]);

      const spec = parseJSON(response);
      ctx.set('spec', spec);

      return { success: true, output: response, data: spec };
    },
  });
}

// ── Prompts ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Spec Generator — you turn plans into precise technical specifications.

Your job:
1. Read the orchestrator's plan
2. Produce detailed file-by-file specifications
3. Define exact function signatures, types, imports, and module boundaries
4. Specify error handling and validation requirements

Your specs are consumed by the Coder agent, so be extremely precise.
Output structured JSON only.`;

function buildPrompt(request: string, plan: Plan): string {
  return `## Original Request

${request}

## Plan from Orchestrator

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\`

## Instructions

Turn this plan into a detailed spec. For each file, specify:

\`\`\`json
{
  "files": [
    {
      "path": "relative/path.js",
      "purpose": "What this file does",
      "exports": ["exported names"],
      "functions": [
        {
          "name": "functionName",
          "params": [{ "name": "arg", "type": "string", "description": "..." }],
          "returns": "string",
          "description": "What it does",
          "errorHandling": "How errors are handled"
        }
      ],
      "dependencies": ["imports needed"]
    }
  ],
  "dataFlow": "How data moves between modules",
  "errorStrategy": "Global error handling approach"
}
\`\`\`

Be meticulous. The Coder agent will implement exactly what you specify.`;
}

function parseJSON(text: string): Spec | RawSpec {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as Spec;
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(text) as Spec;
  } catch {
    /* fall through */
  }
  return { files: [] as never[], raw: text };
}

import { Agent } from '../agent.js';
import type {
  AgentFactoryOptions,
  Plan,
  RawPlan,
  StepResult,
} from '../types.js';

/**
 * Orchestrator agent — the strategic brain.
 *
 * Analyzes the user's request, breaks it into steps,
 * and writes a structured plan to context under key `plan`.
 */
export function orchestrator(opts: AgentFactoryOptions = {}): Agent {
  return Agent.create({
    name: 'Orchestrator',
    role: 'orchestrator',
    model: opts.model ?? 'claude-opus-4-20250514',
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,

    async run(ctx, chat): Promise<StepResult> {
      const response = await chat([
        {
          role: 'user',
          content: `## Task\n\n${ctx.request}\n\n## Working Directory\n\n${ctx.workDir}\n\n${PLANNING_INSTRUCTIONS}`,
        },
      ]);

      const plan = parseJSON(response);
      ctx.set('plan', plan);

      return { success: true, output: response, data: plan };
    },
  });
}

// ── Prompts ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Orchestrator — the strategic brain of an agentic development pipeline.

Your job:
1. Analyze the user's request deeply
2. Produce a structured plan as JSON
3. Be specific — the downstream Coder and Tester agents depend on your clarity

You are expert-level across all programming languages and frameworks.
Always think about architecture, error handling, edge cases, and testability.`;

const PLANNING_INSTRUCTIONS = `## Instructions

Produce a JSON plan:

\`\`\`json
{
  "summary": "One-line summary",
  "architecture": "Brief architecture description",
  "steps": [
    {
      "id": 1,
      "description": "What to do",
      "files": ["paths to create/modify"],
      "details": "Detailed instructions for the coder"
    }
  ],
  "dependencies": ["npm packages needed"],
  "testStrategy": {
    "framework": "vitest|jest|node:test",
    "files": ["test file paths"],
    "coverage": ["what to test"]
  }
}
\`\`\`

Be specific about file paths, function signatures, and data flow.`;

function parseJSON(text: string): Plan | RawPlan {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as Plan;
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(text) as Plan;
  } catch {
    /* fall through */
  }
  return { summary: text, steps: [] as never[], raw: true as const };
}

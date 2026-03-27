import { Agent } from '../agent.js';
import type {
  AgentFactoryOptions,
  CodeFile,
  CodeOutput,
  Plan,
  RawCodeOutput,
  Spec,
  StepResult,
} from '../types.js';

/**
 * Coder agent — generates implementation code from specs.
 *
 * Reads `plan` and `spec` from context, writes `code` to context.
 */
export function coder(opts: AgentFactoryOptions = {}): Agent {
  return Agent.create({
    name: 'Coder',
    role: 'coder',
    model: opts.model ?? 'claude-sonnet-4-20250514',
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,

    async run(ctx, chat): Promise<StepResult> {
      const plan = ctx.get<Plan>('plan');
      const spec = ctx.get<Spec>('spec');

      if (!plan && !spec) {
        return {
          success: false,
          output: 'No plan or spec found. Run earlier agents first.',
        };
      }

      const response = await chat([
        { role: 'user', content: buildPrompt(ctx.request, plan, spec) },
      ]);

      const code = parseCodeOutput(response);
      ctx.set('code', code);

      // Track files as artifacts
      if (code.files) {
        for (const f of code.files) ctx.addFile(f.path);
      }

      return {
        success: true,
        output: response,
        data: code,
        files: code.files?.map((f: CodeFile) => f.path) ?? [],
      };
    },
  });
}

// ── Prompts ──────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Coder — you write clean, production-quality code.

Guidelines:
- Output complete, runnable files — never use placeholders like "// ..."
- Follow the spec exactly — same function names, params, exports
- Use modern JavaScript (ESM, async/await, ?? operator)
- Add JSDoc comments for all exports
- Handle errors gracefully
- Keep functions small and focused

Respond with structured JSON containing all files.`;

function buildPrompt(
  request: string,
  plan: Plan | undefined,
  spec: Spec | undefined,
): string {
  return `## Task

${request}

${plan ? `## Plan\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n` : ''}
${spec ? `## Spec\n\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n` : ''}

## Instructions

Implement the code. Respond with:

\`\`\`json
{
  "files": [
    {
      "path": "relative/path.js",
      "content": "complete file content",
      "description": "what this file does"
    }
  ],
  "dependencies": ["npm packages to install"],
  "summary": "what was implemented"
}
\`\`\`

Write COMPLETE files. No placeholders, no truncation.`;
}

function parseCodeOutput(text: string): CodeOutput | RawCodeOutput {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as CodeOutput;
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(text) as CodeOutput;
  } catch {
    /* fall through */
  }
  return { files: [] as never[], raw: text };
}

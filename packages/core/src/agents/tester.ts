import { Agent } from '../agent.js';
import type {
  CodeFile,
  CodeOutput,
  RawCodeOutput,
  Spec,
  StepResult,
  TestFile,
  TestOutput,
  TesterFactoryOptions,
  RawTestOutput,
} from '../types.js';

/**
 * Tester agent — generates unit tests for the code.
 *
 * Reads `plan`, `spec`, and `code` from context, writes `tests` to context.
 */
export function tester(opts: TesterFactoryOptions = {}): Agent {
  const framework = opts.framework ?? 'vitest';

  return Agent.create({
    name: 'Tester',
    role: 'tester',
    model: opts.model ?? 'claude-sonnet-4-20250514',
    systemPrompt: opts.systemPrompt ?? buildSystemPrompt(framework),

    async run(ctx, chat): Promise<StepResult> {
      const code = ctx.get<CodeOutput | RawCodeOutput>('code');
      if (!code) {
        return { success: false, output: 'No code found. Run Coder first.' };
      }

      const response = await chat([
        {
          role: 'user',
          content: buildPrompt(
            ctx.request,
            ctx.get<Spec>('spec'),
            code,
            framework,
          ),
        },
      ]);

      const tests = parseTestOutput(response);
      ctx.set('tests', tests);

      if (tests.files) {
        for (const f of tests.files) ctx.addFile(f.path);
      }

      return {
        success: true,
        output: response,
        data: tests,
        files: tests.files?.map((f: TestFile) => f.path) ?? [],
      };
    },
  });
}

// ── Prompts ──────────────────────────────────────────────────────

function buildSystemPrompt(framework: string): string {
  return `You are the Tester — you write comprehensive unit tests.

Framework: ${framework}

Guidelines:
- Test all public functions and exported APIs
- Cover happy path, error cases, and edge cases
- Use descriptive test names: "should return empty array when input is empty"
- Mock external dependencies, not internal logic
- Arrange → Act → Assert pattern
- One assertion focus per test
- Include setup/teardown when needed

${frameworkTips(framework)}

Respond with structured JSON containing test files.`;
}

function buildPrompt(
  request: string,
  spec: Spec | undefined,
  code: CodeOutput | RawCodeOutput,
  framework: string,
): string {
  const codeFiles =
    code.files && code.files.length > 0
      ? (code as CodeOutput).files
          .map((f: CodeFile) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
          .join('\n\n')
      : 'raw' in code
        ? (code as RawCodeOutput).raw
        : JSON.stringify(code);

  return `## Task

${request}

${spec ? `## Spec\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n` : ''}

## Source Code

${codeFiles}

## Instructions

Write ${framework} unit tests. Respond with:

\`\`\`json
{
  "files": [
    {
      "path": "relative/path.test.js",
      "content": "complete test file",
      "description": "what is tested",
      "testCount": 5
    }
  ],
  "coverage": ["functions/features covered"],
  "setupInstructions": "any setup needed to run tests"
}
\`\`\``;
}

function frameworkTips(fw: string): string {
  switch (fw) {
    case 'vitest':
      return 'Use: import { describe, it, expect, vi } from "vitest"';
    case 'jest':
      return 'Use: describe/it/expect globals, jest.fn() for mocks';
    case 'node:test':
      return 'Use: import { describe, it } from "node:test"; import assert from "node:assert/strict"';
    default:
      return '';
  }
}

function parseTestOutput(text: string): TestOutput | RawTestOutput {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as TestOutput;
    } catch {
      /* fall through */
    }
  }
  try {
    return JSON.parse(text) as TestOutput;
  } catch {
    /* fall through */
  }
  return { files: [] as never[], raw: text };
}

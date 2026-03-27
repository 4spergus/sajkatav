import chalk from 'chalk';
import ora from 'ora';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { BridgeClient } from '../bridge-client.js';
import type { BridgeEvent, BridgeResult } from '../bridge-client.js';

interface RunOptions {
  port?: string;
  dir?: string;
  agents?: string;
  interactive?: boolean;
}

const AGENT_ICONS: Record<string, string> = {
  orchestrator: '🧠',
  'spec-generator': '📋',
  coder: '💻',
  tester: '🧪',
};

/**
 * `agentic run` — Run the pipeline via the Copilot bridge.
 */
export async function run(
  promptParts: string[] | undefined,
  options: RunOptions,
): Promise<void> {
  const prompt = promptParts?.join(' ');
  const port = options.port ?? '9786';
  const client = new BridgeClient(port);

  const alive = await client.isAlive().catch(() => false);
  if (!alive) {
    console.error(chalk.red('\n✗ Cannot reach the Copilot bridge.\n'));
    console.log(
      chalk.dim(
        'Make sure VS Code is running with the Agentic Pipeline extension.',
      ),
    );
    console.log(
      chalk.dim(
        'The bridge auto-starts, or run command: "Agentic Pipeline: Start CLI Bridge"\n',
      ),
    );
    process.exit(1);
  }

  if (options.interactive || !prompt) {
    await interactive(client, options);
  } else {
    await once(client, prompt, options);
  }
}

async function once(
  client: BridgeClient,
  prompt: string,
  options: RunOptions,
): Promise<void> {
  const workDir = resolve(options.dir ?? '.');
  const agentRoles = options.agents
    ?.split(',')
    .map((r: string) => r.trim());

  console.log(chalk.bold('\n🚀 Agentic Pipeline\n'));
  console.log(chalk.dim(`Bridge: 127.0.0.1:${options.port ?? '9786'}`));
  console.log(chalk.dim(`Work dir: ${workDir}`));
  if (agentRoles) console.log(chalk.dim(`Agents: ${agentRoles.join(', ')}`));
  console.log(chalk.cyan(`\nTask: ${prompt}\n`));

  type Spinner = ReturnType<typeof ora>;
  let spinner: Spinner | null = null;

  try {
    const result = await client.run(
      { prompt, workDir, agentRoles },
      (event: BridgeEvent) => {
        switch (event.event) {
          case 'agent:start': {
            if (spinner) spinner.succeed();
            const icon = AGENT_ICONS[event.role ?? ''] ?? '▶';
            spinner = ora(`${icon} ${event.name}`).start();
            break;
          }
          case 'agent:done': {
            if (spinner) spinner.succeed(`${event.name} — done`);
            spinner = null;
            break;
          }
          case 'agent:error': {
            if (spinner) spinner.fail(`${event.name} — ${event.error}`);
            spinner = null;
            break;
          }
          case 'done':
            break;
        }
      },
    );

    (spinner as Spinner | null)?.succeed();
    printResult(result);
  } catch (err) {
    (spinner as Spinner | null)?.fail();
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\n✗ ${message}\n`));
    process.exit(1);
  }
}

async function interactive(
  client: BridgeClient,
  options: RunOptions,
): Promise<void> {
  console.log(chalk.bold('\n🤖 Agentic Pipeline — Interactive Mode'));
  console.log(chalk.dim('Type your task. "exit" to quit.\n'));

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (): void => {
    rl.question(chalk.green('agentic> '), async (line: string) => {
      const input = line.trim();
      if (!input) {
        ask();
        return;
      }
      if (input === 'exit' || input === 'quit') {
        rl.close();
        return;
      }

      await once(client, input, options);
      console.log('');
      ask();
    });
  };

  ask();
}

function printResult(result: BridgeResult | null): void {
  if (!result) {
    console.log(chalk.yellow('\nNo result returned.'));
    return;
  }

  console.log(chalk.bold('\n📊 Results\n'));

  if (result.files?.length) {
    console.log(chalk.underline('Files:'));
    for (const f of result.files) console.log(chalk.green(`  📄 ${f}`));
    console.log('');
  }

  console.log(chalk.dim(`Timeline: ${result.timeline?.length ?? 0} entries\n`));
}

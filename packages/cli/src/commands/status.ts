import chalk from 'chalk';
import { BridgeClient } from '../bridge-client.js';

interface StatusOptions {
  port?: string;
}

/**
 * `agentic status` — Check if the VS Code bridge is running.
 */
export async function status(options: StatusOptions): Promise<void> {
  const port = options.port ?? '9786';
  const client = new BridgeClient(port);

  process.stdout.write(chalk.dim(`Checking bridge on port ${port}... `));

  const alive = await client.isAlive().catch(() => false);

  if (alive) {
    console.log(chalk.green('✓ Connected'));
    console.log(chalk.dim(`Bridge is running at http://127.0.0.1:${port}\n`));
  } else {
    console.log(chalk.red('✗ Not reachable'));
    console.log(
      chalk.dim(
        '\nMake sure VS Code is running with the Agentic Pipeline extension.\n',
      ),
    );
  }
}

import chalk from "chalk";
import { BridgeClient } from "../bridge-client.js";

interface StatusOptions {
  port?: string;
}

/**
 * `sajkatav stop` — Stop the VS Code bridge.
 */
export async function stop(options: StatusOptions): Promise<void> {
  const port = options.port ?? "9786";
  const client = new BridgeClient(port);

  process.stdout.write(chalk.dim(`Stopping bridge on port ${port}... `));

  const alive = await client.isAlive().catch(() => false);

  if (alive) {
    await client.stopBridge();
    console.log(chalk.dim(`Bridge stopped at http://127.0.0.1:${port}\n`));
  } else {
    console.log(chalk.red("✗ Not reachable"));
    console.log(
      chalk.dim(
        "\nMake sure VS Code is running with the Sajkatav extension active.\n",
      ),
    );
  }
}

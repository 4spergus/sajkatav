import chalk from "chalk";
import { BridgeClient } from "../bridge-client.js";

interface ModelsOptions {
  port?: string;
}

/**
 * `sajkatav models` — List available Copilot models.
 */
export async function models(options: ModelsOptions): Promise<void> {
  const port = options.port ?? "9786";
  const client = new BridgeClient(port);

  const alive = await client.isAlive().catch(() => false);
  if (!alive) {
    console.error(chalk.red("\n✗ Bridge not reachable. Is VS Code running?\n"));
    process.exit(1);
  }

  console.log(chalk.bold("\n📋 Available Copilot Models\n"));

  try {
    const { models: list } = await client.getModels();
    if (list.length === 0) {
      console.log(
        chalk.yellow("  No models available. Check Copilot subscription."),
      );
    } else {
      for (const m of list) console.log(chalk.green(`  ✓ ${m}`));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`  Error: ${message}`));
  }

  console.log("");
}

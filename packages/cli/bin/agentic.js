#!/usr/bin/env node

/**
 * agentic — CLI for the Agentic Pipeline.
 *
 * Connects to the VS Code extension's bridge server to use Copilot models.
 * Start VS Code with the extension active, then use this CLI.
 *
 * Usage:
 *   agentic run "Build a REST API"         Run the full pipeline
 *   agentic run -a orchestrator,coder      Run specific agents
 *   agentic run -i                         Interactive mode
 *   agentic init                           Scaffold pipeline config
 *   agentic status                         Check bridge connection
 *   agentic models                         List available Copilot models
 */

import { program } from 'commander';
import { run } from '../dist/commands/run.js';
import { init } from '../dist/commands/init.js';
import { status } from '../dist/commands/status.js';
import { models } from '../dist/commands/models.js';

program
  .name('agentic')
  .description('Agentic Pipeline CLI — Orchestrator → Spec → Coder → Tester via Copilot')
  .version('1.0.0');

program
  .command('run')
  .description('Run the pipeline (connects to VS Code bridge)')
  .argument('[prompt...]', 'Task description')
  .option('-i, --interactive', 'Interactive REPL mode')
  .option('-d, --dir <path>', 'Working directory', '.')
  .option('-a, --agents <roles>', 'Comma-separated agent roles to run (e.g. orchestrator,coder)')
  .option('-p, --port <port>', 'Bridge server port', '9786')
  .action(run);

program
  .command('status')
  .description('Check if the VS Code bridge is running')
  .option('-p, --port <port>', 'Bridge port', '9786')
  .action(status);

program
  .command('models')
  .description('List available Copilot models')
  .option('-p, --port <port>', 'Bridge port', '9786')
  .action(models);

program.parse();

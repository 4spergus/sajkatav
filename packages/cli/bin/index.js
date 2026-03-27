#!/usr/bin/env node

/**
 * sajkatav — CLI for the Agentic Pipeline.
 *
 * Connects to the VS Code extension's bridge server to use Copilot models.
 * Start VS Code with the extension active, then use this CLI.
 *
 * Usage:
 *   sajkatav run "Build a REST API"         Run the full pipeline
 *   sajkatav run -a orchestrator,coder      Run specific agents
 *   sajkatav run -i                         Interactive mode
 *   sajkatav init                           Scaffold pipeline config
 *   sajkatav status                         Check bridge connection
 *   sajkatav models                         List available Copilot models
 */

import { program } from "commander";
import { run } from "../dist/commands/run.js";
import { status } from "../dist/commands/status.js";
import { models } from "../dist/commands/models.js";

program
  .name("sajkatav")
  .description(
    "Sajkatav CLI — Orchestrator → Spec → Coder → Tester via Copilot",
  )
  .version("1.0.0");

program
  .command("run")
  .description("Run the pipeline (connects to VS Code bridge)")
  .argument("[prompt...]", "Task description")
  .option("-i, --interactive", "Interactive REPL mode")
  .option("-d, --dir <path>", "Working directory", ".")
  .option(
    "-a, --agents <roles>",
    "Comma-separated agent roles to run (e.g. orchestrator,coder)",
  )
  .option("-p, --port <port>", "Bridge server port", "9786")
  .action(run);

program
  .command("status")
  .description("Check if the VS Code bridge is running")
  .option("-p, --port <port>", "Bridge port", "9786")
  .action(status);

program
  .command("models")
  .description("List available Copilot models")
  .option("-p, --port <port>", "Bridge port", "9786")
  .action(models);

program.parse();

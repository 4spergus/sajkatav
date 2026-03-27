import * as vscode from "vscode";
import { Pipeline, Context, agents } from "@sajkatav/core";
import type { StepResult } from "@sajkatav/core";
import { CopilotProvider } from "./provider.js";
import { persistArtifacts } from "./artifacts.js";

let lastCtx: Context | null = null;

interface AgenticConfig {
  orchestratorModel: string;
  specGeneratorModel: string;
  coderModel: string;
  testerModel: string;
  testFramework: string;
}

/**
 * Register the @pipeline chat participant.
 */
export function registerParticipant(
  extCtx: vscode.ExtensionContext,
  log: vscode.LogOutputChannel,
): void {
  const participant = vscode.chat.createChatParticipant(
    "sajkatav.agent",
    (
      request: vscode.ChatRequest,
      _chatCtx: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      _token: vscode.CancellationToken,
    ) => handleRequest(request, stream, _token, log),
  );

  participant.iconPath = new vscode.ThemeIcon("beaker");
  extCtx.subscriptions.push(participant);
}

/**
 * Route chat commands to the right handler.
 */
async function handleRequest(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  _token: vscode.CancellationToken,
  log: vscode.LogOutputChannel,
): Promise<{ metadata: Record<string, unknown> } | void> {
  const cmd = request.command ?? "run";
  const prompt = request.prompt;

  try {
    switch (cmd) {
      case "plan":
        return await runSubset(prompt, ["orchestrator"], stream, log);
      case "spec":
        return await runSubset(
          prompt,
          ["orchestrator", "spec-generator"],
          stream,
          log,
        );
      case "code":
        return await runSubset(
          prompt,
          ["orchestrator", "spec-generator", "coder"],
          stream,
          log,
        );
      case "test":
        return await runSingle(prompt, "tester", stream, log);
      case "run":
      default:
        return await runFull(prompt, stream, log);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stream.markdown(`\n**Error:** ${message}\n`);
    log.error(message);
    return { metadata: { error: message } };
  }
}

// ── Full pipeline ────────────────────────────────────────────────

async function runFull(
  prompt: string,
  stream: vscode.ChatResponseStream,
  log: vscode.LogOutputChannel,
): Promise<{ metadata: Record<string, unknown> }> {
  const pipeline = buildPipeline();

  stream.markdown("## 🚀 Sajkatav Pipeline\n\n");
  stream.markdown(`**Task:** ${prompt}\n\n---\n\n`);

  attachStreamListeners(pipeline, stream, log);

  const ctx = await pipeline.run({
    request: prompt,
    workDir: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });

  const persisted = await persistArtifacts(ctx);
  log.info(
    `Persisted artifacts: ${persisted.written.length} written, ${persisted.skipped.length} skipped`,
  );

  lastCtx = ctx;
  renderResults(
    ctx,
    stream,
    persisted.written.length,
    persisted.skipped.length,
  );

  return { metadata: { success: true, files: ctx.files } };
}

// ── Subset (run only some agents) ────────────────────────────────

async function runSubset(
  prompt: string,
  roles: string[],
  stream: vscode.ChatResponseStream,
  log: vscode.LogOutputChannel,
): Promise<{ metadata: Record<string, unknown> }> {
  const allAgents = buildAgents();
  const subset = allAgents.filter((a) => roles.includes(a.role));

  const pipeline = Pipeline.create({
    provider: new CopilotProvider(),
    agents: subset,
  });

  stream.markdown(`## Running: ${subset.map((a) => a.name).join(" → ")}\n\n`);
  attachStreamListeners(pipeline, stream, log);

  const ctx = await pipeline.run({
    request: prompt,
    workDir: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });

  const persisted = await persistArtifacts(ctx);
  log.info(
    `Persisted artifacts: ${persisted.written.length} written, ${persisted.skipped.length} skipped`,
  );

  lastCtx = ctx;
  renderResults(
    ctx,
    stream,
    persisted.written.length,
    persisted.skipped.length,
  );

  return { metadata: { success: true } };
}

// ── Single agent using last context ──────────────────────────────

async function runSingle(
  prompt: string,
  role: string,
  stream: vscode.ChatResponseStream,
  log: vscode.LogOutputChannel,
): Promise<{ metadata: Record<string, unknown> }> {
  const allAgents = buildAgents();
  const agent = allAgents.find((a) => a.role === role);
  if (!agent) throw new Error(`No agent with role "${role}"`);

  const pipeline = Pipeline.create({
    provider: new CopilotProvider(),
    agents: [agent],
  });

  stream.markdown(`## Running: ${agent.name}\n\n`);
  attachStreamListeners(pipeline, stream, log);

  // If we have previous context, build a new one seeded with its data
  if (lastCtx) {
    const ctx = new Context({
      request: prompt || lastCtx.request,
      workDir: lastCtx.workDir,
    });
    for (const key of ["plan", "spec", "code", "tests"] as const) {
      if (lastCtx.has(key)) ctx.set(key, lastCtx.get(key));
    }
  }

  const result = await pipeline.run({
    request: prompt || lastCtx?.request || "Generate tests",
    workDir: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
  });

  const persisted = await persistArtifacts(result);
  log.info(
    `Persisted artifacts: ${persisted.written.length} written, ${persisted.skipped.length} skipped`,
  );

  lastCtx = result;
  renderResults(
    result,
    stream,
    persisted.written.length,
    persisted.skipped.length,
  );

  return { metadata: { success: true } };
}

// ── Helpers ──────────────────────────────────────────────────────

function getConfig(): AgenticConfig {
  const cfg = vscode.workspace.getConfiguration("sajkatav");
  return {
    orchestratorModel: cfg.get<string>("models.orchestrator", "gpt-4o"),
    specGeneratorModel: cfg.get<string>("models.specGenerator", "gpt-4o"),
    coderModel: cfg.get<string>("models.coder", "gpt-4o"),
    testerModel: cfg.get<string>("models.tester", "gpt-4o"),
    testFramework: cfg.get<string>("tester.framework", "vitest"),
  };
}

function buildAgents() {
  const cfg = getConfig();
  return [
    agents.orchestrator({ model: cfg.orchestratorModel }),
    agents.specGenerator({ model: cfg.specGeneratorModel }),
    agents.coder({ model: cfg.coderModel }),
    agents.tester({ model: cfg.testerModel, framework: cfg.testFramework }),
  ];
}

function buildPipeline(): Pipeline {
  return Pipeline.create({
    provider: new CopilotProvider(),
    agents: buildAgents(),
  });
}

const AGENT_ICONS: Record<string, string> = {
  orchestrator: "🧠",
  "spec-generator": "📋",
  coder: "💻",
  tester: "🧪",
};

function attachStreamListeners(
  pipeline: Pipeline,
  stream: vscode.ChatResponseStream,
  log: vscode.LogOutputChannel,
): void {
  pipeline.on(
    "agent:start",
    ({ name, role }: { name: string; role: string }) => {
      const icon = AGENT_ICONS[role] ?? "▶";
      stream.markdown(`### ${icon} ${name}\n\n`);
      stream.progress(`${name} is working...`);
      log.info(`Agent started: ${name}`);
    },
  );

  pipeline.on(
    "agent:done",
    ({ name, result }: { name: string; result: StepResult }) => {
      if (
        result.data &&
        typeof result.data === "object" &&
        !("raw" in result.data)
      ) {
        stream.markdown(
          "```json\n" + JSON.stringify(result.data, null, 2) + "\n```\n\n",
        );
      } else if (result.output) {
        stream.markdown(result.output.substring(0, 3000) + "\n\n");
      }
      log.info(`Agent done: ${name}`);
    },
  );

  pipeline.on(
    "agent:error",
    ({ name, result }: { name: string; result: StepResult }) => {
      stream.markdown(`**${name} failed:** ${result.output}\n\n`);
      log.error(`Agent failed: ${name}: ${result.output}`);
    },
  );
}

function renderResults(
  ctx: Context,
  stream: vscode.ChatResponseStream,
  writtenCount = 0,
  skippedCount = 0,
): void {
  stream.markdown("---\n\n### ✅ Pipeline Complete\n\n");

  stream.markdown(
    `**Applied artifacts:** ${writtenCount} written${skippedCount > 0 ? `, ${skippedCount} skipped (outside workspace)` : ""}\n\n`,
  );

  if (ctx.files.length > 0) {
    stream.markdown("**Files:**\n");
    for (const f of ctx.files) {
      stream.markdown(`- \`${f}\`\n`);
    }
  }

  stream.markdown(`\n*${ctx.timeline.length} log entries*\n`);
}

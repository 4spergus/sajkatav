import * as http from "node:http";
import * as vscode from "vscode";
import { Pipeline, agents } from "@sajkatav/core";
import type { StepResult } from "@sajkatav/core";
import { CopilotProvider } from "./provider.js";
import { persistArtifacts } from "./artifacts.js";

interface AgenticConfig {
  shouldUseFreeTier: boolean;
  freeTierModels: string[];
  orchestratorModel: string;
  specGeneratorModel: string;
  coderModel: string;
  testerModel: string;
  testFramework: string;
}

interface RunBody {
  prompt?: string;
  workDir?: string;
  agentRoles?: string[];
}

interface ChatBody {
  messages?: Array<{ role: string; content: string }>;
  model?: string;
}

/**
 * BridgeServer — A tiny HTTP server that exposes Copilot-powered
 * pipeline execution to the CLI.
 *
 * Endpoints:
 *   POST /run       { prompt, workDir? }     → Full pipeline (NDJSON stream)
 *   POST /chat      { messages, model? }     → Raw model chat
 *   GET  /health                             → { ok: true }
 *   GET  /models                             → Available model families
 */
export class BridgeServer {
  #server: http.Server | null = null;
  readonly #port: number;
  readonly #log: vscode.LogOutputChannel;

  constructor(port: number, log: vscode.LogOutputChannel) {
    this.#port = port;
    this.#log = log;
  }

  start(): void {
    if (this.#server) return;

    this.#server = http.createServer(
      (req: http.IncomingMessage, res: http.ServerResponse) =>
        this.#handle(req, res),
    );

    this.#server.listen(this.#port, "127.0.0.1", () => {
      this.#log.info(
        `Bridge server listening on http://127.0.0.1:${this.#port}`,
      );
      vscode.window.showInformationMessage(
        `Sajkatav Pipeline bridge running on port ${this.#port}`,
      );
    });

    this.#server.on("error", (err: NodeJS.ErrnoException) => {
      this.#log.error(`Bridge error: ${err.message}`);
      if (err.code === "EADDRINUSE") {
        vscode.window.showWarningMessage(
          `Port ${this.#port} in use. Change sajkatav.bridge.port in settings.`,
        );
      }
    });
  }

  stop(): void {
    if (this.#server) {
      this.#server.close();
      this.#server = null;
      this.#log.info("Bridge server stopped");
      vscode.window.showInformationMessage("Sajkatav Pipeline bridge stopped");
    }
  }

  get isRunning(): boolean {
    return this.#server !== null;
  }

  async #handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    res.setHeader("Access-Control-Allow-Origin", "127.0.0.1");
    res.setHeader("Content-Type", "application/json");

    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${this.#port}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/health") {
        send(res, 200, { ok: true, port: this.#port });
        return;
      }

      if (req.method === "GET" && path === "/models") {
        await this.#handleModels(res);
        return;
      }

      if (req.method === "POST" && path === "/run") {
        const body = (await readBody(req)) as RunBody;
        await this.#handleRun(body, res);
        return;
      }

      if (req.method === "POST" && path === "/chat") {
        const body = (await readBody(req)) as ChatBody;
        await this.#handleChat(body, res);
        return;
      }

      if (req.method === "POST" && path === "/stop") {
        this.stop();
        send(res, 200, { ok: true });
        return;
      }

      send(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#log.error(`Bridge request error: ${message}`);
      send(res, 500, { error: message });
    }
  }

  /** POST /run — Run the full pipeline. */
  async #handleRun(body: RunBody, res: http.ServerResponse): Promise<void> {
    const { prompt, workDir, agentRoles } = body;
    if (!prompt) {
      send(res, 400, { error: 'Missing "prompt"' });
      return;
    }

    this.#log.info(`Bridge /run: "${prompt}"`);

    const cfg = getConfig();
    const allAgents = [
      agents.orchestrator({ model: cfg.orchestratorModel }),
      agents.specGenerator({ model: cfg.specGeneratorModel }),
      agents.coder({ model: cfg.coderModel }),
      agents.tester({
        model: cfg.testerModel,
        framework: cfg.testFramework,
      }),
    ];

    const filtered = agentRoles
      ? allAgents.filter((a) => agentRoles.includes(a.role))
      : allAgents;

    const pipeline = Pipeline.create({
      provider: new CopilotProvider(),
      agents: filtered,
    });

    // Stream events as NDJSON
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    pipeline.on(
      "agent:start",
      ({ name, role }: { name: string; role: string }) => {
        res.write(JSON.stringify({ event: "agent:start", name, role }) + "\n");
      },
    );

    pipeline.on(
      "agent:done",
      ({ name, result }: { name: string; result: StepResult }) => {
        res.write(
          JSON.stringify({ event: "agent:done", name, data: result.data }) +
            "\n",
        );
      },
    );

    pipeline.on(
      "agent:error",
      ({ name, result }: { name: string; result: StepResult }) => {
        res.write(
          JSON.stringify({
            event: "agent:error",
            name,
            error: result.output,
          }) + "\n",
        );
      },
    );

    const ctx = await pipeline.run({
      request: prompt,
      workDir: workDir ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    });

    const persisted = await persistArtifacts(ctx);
    this.#log.info(
      `Persisted artifacts: ${persisted.written.length} written, ${persisted.skipped.length} skipped`,
    );

    res.write(
      JSON.stringify({
        event: "done",
        result: ctx.toJSON(),
        persisted,
      }) + "\n",
    );
    res.end();
  }

  /** POST /chat — Direct model access. */
  async #handleChat(body: ChatBody, res: http.ServerResponse): Promise<void> {
    const { messages, model } = body;
    if (!messages) {
      send(res, 400, { error: 'Missing "messages"' });
      return;
    }

    const provider = new CopilotProvider();
    const response = await provider.chat(
      messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      { model },
    );

    send(res, 200, { response });
  }

  //TODO: Add support for free tier, and change how config is handled (currently it is read on multiple places, should be centralized)
  /** GET /models — List available model families. */
  async #handleModels(res: http.ServerResponse): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels();

      const available = Array.from(
        new Set(
          models.map((model) => `${model.vendor}:${model.family}:${model.id}`),
        ),
      );
      send(res, 200, { models: available });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send(res, 500, { error: message });
    }
  }
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
    shouldUseFreeTier: cfg.get<boolean>("freeTier.enabled", false),
    freeTierModels: cfg.get<string[]>("freeTier.models", ["gpt-4o", "gpt-4.1"]),
  };
}

function send(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  res.writeHead(status);
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

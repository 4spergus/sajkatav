import http from "node:http";

const DEFAULT_PORT = 9786;

/** An NDJSON stream event from the bridge. */
export interface BridgeEvent {
  event: "agent:start" | "agent:done" | "agent:error" | "done";
  name?: string;
  role?: string;
  data?: unknown;
  error?: string;
  result?: BridgeResult;
  persisted?: PersistedArtifacts;
}

export interface PersistedArtifacts {
  written: string[];
  skipped: string[];
}

/** The final result from a pipeline run. */
export interface BridgeResult {
  request: string;
  workDir: string;
  store: Record<string, unknown>;
  files: string[];
  timeline: Array<{
    agent: string;
    message: string;
    data?: unknown;
    time: string;
  }>;
}

interface HealthResponse {
  ok: boolean;
  port: number;
}

interface ModelsResponse {
  models: string[];
}

interface ChatResponse {
  response: string;
}

/**
 * BridgeClient — Connects the CLI to the VS Code extension's bridge server.
 *
 * All model calls go through Copilot via this bridge.
 */
export class BridgeClient {
  readonly #port: number;

  constructor(port: number | string = DEFAULT_PORT) {
    this.#port = Number(port);
  }

  /** Check if the bridge is reachable. */
  async isAlive(): Promise<boolean> {
    try {
      const res = await this.#get<HealthResponse>("/health");
      return res.ok === true;
    } catch {
      return false;
    }
  }

  async stopBridge(): Promise<void> {
    return this.#post("/stop", {});
  }

  /** List available Copilot models. */
  async getModels(): Promise<ModelsResponse> {
    return this.#get<ModelsResponse>("/models");
  }

  /**
   * Run the pipeline via the bridge (streams NDJSON events).
   */
  async run(
    params: { prompt: string; workDir?: string; agentRoles?: string[] },
    onEvent: (event: BridgeEvent) => void,
  ): Promise<BridgeResult | null> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(params);

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: this.#port,
          path: "/run",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          let buffer = "";
          let lastResult: BridgeResult | null = null;

          res.on("data", (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line) as BridgeEvent;
                if (event.event === "done" && event.result) {
                  lastResult = event.result;
                }
                onEvent(event);
              } catch {
                /* skip malformed line */
              }
            }
          });

          res.on("end", () => resolve(lastResult));
          res.on("error", reject);
        },
      );

      req.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ECONNREFUSED") {
          reject(
            new Error(
              `Cannot connect to bridge on port ${this.#port}.\n` +
                "Make sure VS Code is running with the Sajkatav extension active.\n" +
                "The bridge auto-starts with VS Code, or run: Sajkatav: Start CLI Bridge",
            ),
          );
        } else {
          reject(err);
        }
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Direct chat with a Copilot model (for custom use).
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    model?: string,
  ): Promise<string> {
    const res = await this.#post<ChatResponse>("/chat", { messages, model });
    return res.response;
  }

  // ── Internal ──

  #get<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${this.#port}${path}`, (res) => {
          let data = "";
          res.on("data", (c: Buffer) => (data += c.toString()));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error("Invalid response"));
            }
          });
        })
        .on("error", reject);
    });
  }

  #post<T>(path: string, body: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const json = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: this.#port,
          path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(json),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (c: Buffer) => (data += c.toString()));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data) as T);
            } catch {
              reject(new Error("Invalid response"));
            }
          });
        },
      );
      req.on("error", reject);
      req.write(json);
      req.end();
    });
  }
}

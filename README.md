# Sajkatav

A configurable, reusable agentic development pipeline powered entirely by **GitHub Copilot**.

```
┌──────────────────────────────────────────────────┐
│                 User Request                      │
│         (VS Code Chat or CLI)                     │
└───────────────────┬──────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────┐
│  🧠 Orchestrator (Claude Opus)                    │
│  Analyzes → produces a structured plan            │
└───────────────────┬──────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────┐
│  📋 Spec Generator (Claude Sonnet 4)              │
│  Turns plan → detailed file-level specs           │
└───────────────────┬──────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────┐
│  💻 Coder (Claude Sonnet 4)                       │
│  Implements code from the spec                    │
└───────────────────┬──────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────┐
│  🧪 Tester (Claude Sonnet 4)                      │
│  Generates unit tests for the code                │
└──────────────────────────────────────────────────┘
```

## Key Design Decisions

| Decision                  | Choice          | Why                                                                                     |
| ------------------------- | --------------- | --------------------------------------------------------------------------------------- |
| **Model provider**        | Copilot only    | Single auth, consistent billing, no API keys to manage                                  |
| **Orchestrator model**    | Claude Opus     | Best for complex reasoning, planning, and review                                        |
| **Coder / Spec / Tester** | Claude Sonnet 4 | Fast, precise, excellent code quality                                                   |
| **CLI ↔ Copilot**         | Bridge server   | VS Code extension exposes a local HTTP endpoint so the CLI uses the same Copilot models |
| **Library**               | TypeScript, ESM | Strict types, tree-shakable, easy to extend                                             |

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Use via VS Code (primary)

Open Copilot Chat and type:

```
@pipeline /run Build a REST API with Express and JWT auth
```

**Available commands:**
| Command | What it does |
|---------|-------------|
| `@pipeline /run <task>` | Full pipeline: Orchestrate → Spec → Code → Test |
| `@pipeline /plan <task>` | Orchestrator only |
| `@pipeline /spec <task>` | Orchestrator + Spec Generator |
| `@pipeline /code <task>` | Orchestrator + Spec + Coder |
| `@pipeline /test <task>` | Tester only (uses last run's context) |

### 3. Use via CLI

The CLI connects to VS Code through a local bridge server (auto-started by the extension):

```bash
# Check connection
npx sajkatav status

# Run the full pipeline
npx sajkatav run "Build a REST API with Express"

# Run specific agents only
npx sajkatav run -a orchestrator,coder "Add a /users endpoint"

# Interactive mode
npx sajkatav run -i

# List available Copilot models
npx sajkatav models
```

### 4. Use as a library

```ts
import { Pipeline, agents } from "@sajkatav/core";
import type {
  Provider,
  Plan,
  Spec,
  CodeOutput,
  TestOutput,
} from "@sajkatav/core";

// You provide the provider — in VS Code, that's CopilotProvider
const pipeline = Pipeline.create({
  provider: myCopilotProvider,
  agents: [
    agents.orchestrator(),
    agents.specGenerator(),
    agents.coder(),
    agents.tester({ framework: "vitest" }),
  ],
});

// Run — fully typed context
const ctx = await pipeline.run("Build a todo app");
console.log(ctx.get<Plan>("plan")); // Orchestrator output
console.log(ctx.get<Spec>("spec")); // Spec Generator output
console.log(ctx.get<CodeOutput>("code")); // Coder output
console.log(ctx.get<TestOutput>("tests")); // Tester output
console.log(ctx.files); // All file paths produced
```

### 5. Custom agents

```ts
import { Agent, Pipeline } from "@sajkatav/core";
import type { StepResult } from "@sajkatav/core";

const reviewer = Agent.create({
  name: "Reviewer",
  role: "reviewer",
  model: "claude-opus-4-20250514",
  systemPrompt: "You review code for security issues...",
  run: async (ctx, chat): Promise<StepResult> => {
    const code = ctx.get<string>("code");
    const review = await chat([
      { role: "user", content: `Review this code:\n${JSON.stringify(code)}` },
    ]);
    ctx.set("review", review);
    return { success: true, output: review };
  },
});

// Add to pipeline
const pipeline = Pipeline.create({
  provider,
  agents: [agents.orchestrator(), agents.coder(), reviewer],
});
```

## How the CLI ↔ Copilot bridge works

```
┌──────────────┐         HTTP (localhost:9786)         ┌──────────────────┐
│              │  ──── POST /run {prompt} ──────────▶   │                  │
│   CLI        │                                        │  VS Code         │
│  (sajkatav)   │  ◀──── NDJSON stream ──────────────   │  Extension       │
│              │         {event, data}                  │  (bridge.js)     │
└──────────────┘                                        │       │          │
                                                        │       ▼          │
                                                        │  vscode.lm API  │
                                                        │  (Copilot)       │
                                                        └──────────────────┘
```

The extension starts a bridge server on `127.0.0.1:9786` (configurable). The CLI sends prompts to it, and the bridge runs the pipeline using `vscode.lm` — the same Copilot API used by the chat participant. Results stream back as newline-delimited JSON.

## Project Structure

```
packages/
  core/                          # Library (TypeScript, no VS Code dependency)
    src/
      index.ts                   # Public API
      types.ts                   # All type definitions
      agent.ts                   # Agent class
      pipeline.ts                # Pipeline engine
      context.ts                 # Shared blackboard
      config.ts                  # Config helpers
      agents/
        orchestrator.ts          # 🧠 Planning
        spec-generator.ts        # 📋 Specifications
        coder.ts                 # 💻 Code generation
        tester.ts                # 🧪 Test generation
    dist/                        # SWC-compiled output + .d.ts

  cli/                           # CLI (thin client → bridge)
    bin/index.js               # Entry point (JS shim)
    src/
      bridge-client.ts           # HTTP client for bridge
      commands/
        run.ts                   # sajkatav run
        status.ts                # sajkatav status
        models.ts                # sajkatav models
    dist/                        # SWC-compiled output

  vscode-extension/              # VS Code Extension
    src/
      extension.ts               # Activation
      provider.ts                # CopilotProvider (the ONLY provider)
      participant.ts             # @pipeline chat participant
      bridge.ts                  # HTTP bridge for CLI
    out/                         # esbuild-bundled output
```

## Configuration

### VS Code Settings

```json
{
  "sajkatav.models.orchestrator": "claude-opus-4-20250514",
  "sajkatav.models.specGenerator": "claude-sonnet-4-20250514",
  "sajkatav.models.coder": "claude-sonnet-4-20250514",
  "sajkatav.models.tester": "claude-sonnet-4-20250514",
  "sajkatav.tester.framework": "vitest",
  "sajkatav.bridge.autoStart": true,
  "sajkatav.bridge.port": 9786,
  "sajkatav.freeTier.enabled": true,
  "sajkatav.freeTier.models": ["GPT-4o", "GPT-4.1"]
}
```

## Development

```bash
# Install dependencies
npm install

# Build everything (core → cli → extension)
npm run build

# Type-check all packages (no emit)
npm run typecheck

# Build individual packages
npm run build:core    # SWC compile + .d.ts
npm run build:cli     # SWC compile + .d.ts
npm run build:ext     # esbuild bundle

# Clean all build outputs
npm run clean

# Run CLI
node packages/cli/bin/index.js --help

# Package extension as .vsix
cd packages/vscode-extension && npx @vscode/vsce package --no-dependencies
```

### Tech Stack

| Tool           | Purpose                                 |
| -------------- | --------------------------------------- |
| **TypeScript** | Strict types (`strict: true`, no `any`) |
| **SWC**        | Fast compilation for core + CLI         |
| **esbuild**    | Extension bundling (CJS for VS Code)    |
| **tsc**        | Type-checking + `.d.ts` generation only |

## License

MIT

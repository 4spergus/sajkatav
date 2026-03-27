import * as vscode from "vscode";
import { registerParticipant } from "./participant.js";
import { BridgeServer } from "./bridge.js";

let bridge: BridgeServer | null = null;

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Sajkatav", {
    log: true,
  });
  output.info("Sajkatav activated");

  // Register @sajkatav chat participant
  registerParticipant(context, output);

  // Bridge server for CLI
  const cfg = vscode.workspace.getConfiguration("sajkatav");

  context.subscriptions.push(
    vscode.commands.registerCommand("sajkatav.run", async () => {
      const prompt = await vscode.window.showInputBox({
        title: "Sajkatav: Run a pipeline",
        prompt: "Describe the task",
        placeHolder: "Build a REST API with Express...",
      });
      if (prompt) {
        await vscode.commands.executeCommand("workbench.action.chat.open", {
          query: `@sajkatav /run ${prompt}`,
        });
      }
    }),

    vscode.commands.registerCommand("sajkatav.startBridge", () => {
      if (bridge) {
        vscode.window.showInformationMessage("Bridge already running");
        return;
      }
      const port = cfg.get<number>("bridge.port", 9786);
      bridge = new BridgeServer(port, output);
      bridge.start();
    }),

    vscode.commands.registerCommand("sajkatav.stopBridge", () => {
      bridge?.stop();
      bridge = null;
    }),
  );

  // Auto-start bridge
  if (cfg.get<boolean>("bridge.autoStart", true)) {
    const port = cfg.get<number>("bridge.port", 9786);
    bridge = new BridgeServer(port, output);
    bridge.start();
  }
}

export function deactivate(): void {
  bridge?.stop();
}

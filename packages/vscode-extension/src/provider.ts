import * as vscode from 'vscode';
import type {
  Provider,
  Message,
  ModelOptions,
} from '@anthropic-ai/agentic-pipeline';

/**
 * CopilotProvider — the ONLY model provider.
 *
 * Wraps `vscode.lm.selectChatModels()` to send messages to Copilot-hosted models.
 * This is what makes everything work through Copilot.
 */
export class CopilotProvider implements Provider {
  readonly name = 'copilot' as const;

  async #selectModel(modelHint?: string): Promise<vscode.LanguageModelChat> {
    if (modelHint) {
      const byFamily = await vscode.lm.selectChatModels({ family: modelHint });
      if (byFamily.length > 0) return byFamily[0]!;

      const byId = await vscode.lm.selectChatModels({ id: modelHint });
      if (byId.length > 0) return byId[0]!;
    }

    const all = await vscode.lm.selectChatModels();
    if (all.length > 0) return all[0]!;

    throw new Error(
      modelHint
        ? `No Copilot model found for "${modelHint}" and no fallback models are available. Is GitHub Copilot active?`
        : 'No Copilot chat models are available. Is GitHub Copilot active?',
    );
  }

  /**
   * Send messages to a Copilot model and get a response.
   */
  async chat(messages: Message[], opts: ModelOptions = {}): Promise<string> {
    const model = await this.#selectModel(opts.model ?? 'claude-sonnet-4-20250514');
    const vscodeMessages = messages.map((m) =>
      m.role === 'assistant'
        ? vscode.LanguageModelChatMessage.Assistant(m.content)
        : vscode.LanguageModelChatMessage.User(m.content),
    );

    const tokenSource = new vscode.CancellationTokenSource();
    const response = await model.sendRequest(
      vscodeMessages,
      {},
      tokenSource.token,
    );

    let result = '';
    for await (const chunk of response.text) {
      result += chunk;
    }
    return result;
  }

  /**
   * Stream a response, calling onChunk for each piece.
   */
  async chatStream(
    messages: Message[],
    onChunk: (chunk: string) => void,
    opts: ModelOptions = {},
  ): Promise<string> {
    const model = await this.#selectModel(opts.model ?? 'claude-sonnet-4-20250514');
    const vscodeMessages = messages.map((m) =>
      m.role === 'assistant'
        ? vscode.LanguageModelChatMessage.Assistant(m.content)
        : vscode.LanguageModelChatMessage.User(m.content),
    );

    const tokenSource = new vscode.CancellationTokenSource();
    const response = await model.sendRequest(
      vscodeMessages,
      {},
      tokenSource.token,
    );

    let result = '';
    for await (const chunk of response.text) {
      result += chunk;
      onChunk(chunk);
    }
    return result;
  }
}

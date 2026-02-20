import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerStoreTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  _cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_store",
    description:
      "Save information to long-term memory. Mengram automatically extracts " +
      "facts (semantic), events (episodic), and workflows (procedural) from the text. " +
      "Use when the user shares personal info, completes a task, or says something worth remembering.",
    parameters: Type.Object({
      text: Type.String({
        description:
          "Text to store — can be a direct fact, conversation summary, or workflow description",
      }),
    }),
    async execute(_toolCallId: string, params: { text: string }) {
      try {
        const result = await client.addText(params.text);

        return {
          content: [
            {
              type: "text" as const,
              text: `Stored to memory. Status: ${result.status}`,
            },
          ],
        };
      } catch (err) {
        log.error(`store tool: ${(err as Error).message}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to store memory: ${(err as Error).message}`,
            },
          ],
        };
      }
    },
  });
}

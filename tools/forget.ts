import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerForgetTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  _cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_forget",
    description:
      "Delete a specific memory entity by name. Use when the user asks you to " +
      "forget something or when information is outdated and should be removed.",
    parameters: Type.Object({
      entity: Type.String({
        description: "Name of the entity to delete (e.g., 'old phone number')",
      }),
    }),
    async execute(_toolCallId: string, params: { entity: string }) {
      try {
        await client.deleteMemory(params.entity);
        return {
          content: [
            {
              type: "text" as const,
              text: `Deleted "${params.entity}" from memory.`,
            },
          ],
        };
      } catch (err) {
        log.error(`forget tool: ${(err as Error).message}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to delete: ${(err as Error).message}`,
            },
          ],
        };
      }
    },
  });
}

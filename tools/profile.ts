import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerProfileTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  _cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_profile",
    description:
      "Get the user's cognitive profile — an AI-generated summary of who they are, " +
      "their preferences, recent events, and known workflows. Use when the user asks " +
      "'what do you know about me?' or at the start of a session for context.",
    parameters: Type.Object({
      force: Type.Optional(
        Type.Boolean({
          description: "Force regenerate profile (bypasses 1-hour cache)",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { force?: boolean },
    ) {
      try {
        const profile = await client.getProfile("default", params.force);

        if (profile.status !== "ok") {
          return {
            content: [
              {
                type: "text" as const,
                text: `Profile status: ${profile.status}${profile.error ? ` — ${profile.error}` : ""}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: profile.system_prompt,
            },
          ],
          details: {
            facts_used: profile.facts_used,
            last_updated: profile.last_updated,
          },
        };
      } catch (err) {
        log.error(`profile tool: ${(err as Error).message}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get profile: ${(err as Error).message}`,
            },
          ],
        };
      }
    },
  });
}

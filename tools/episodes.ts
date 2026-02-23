import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerEpisodesTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_episodes",
    description:
      "Search or list episodic memories — past events, interactions, and experiences " +
      "with timestamps and outcomes. Use to recall what happened, when, and what the " +
      "result was. Omit query to list recent episodes.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({ description: "Search query (omit to list recent)" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Max results (default: 10)" }),
      ),
      after: Type.Optional(
        Type.String({ description: "ISO date — only events after this date" }),
      ),
      before: Type.Optional(
        Type.String({ description: "ISO date — only events before this date" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query?: string; limit?: number; after?: string; before?: string },
    ) {
      try {
        const limit = params.limit ?? cfg.maxEpisodes;
        let episodes: Array<{
          id: string;
          summary: string;
          outcome?: string | null;
          participants: string[];
          emotional_valence?: string | null;
          importance: number;
          created_at: string;
        }>;

        if (params.query) {
          const data = await client.searchEpisodes(
            params.query,
            limit,
            params.after,
            params.before,
          );
          episodes = data.results ?? [];
        } else {
          const data = await client.getEpisodes(
            limit,
            params.after,
            params.before,
          );
          episodes = data.episodes ?? [];
        }

        if (episodes.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: params.query
                ? `No episodes found matching "${params.query}".`
                : "No episodes recorded yet.",
            }],
          };
        }

        const lines = episodes.map((ep) => {
          const date = ep.created_at?.split("T")[0] ?? "unknown";
          let line = `[${date}] ${ep.summary}`;
          if (ep.outcome) line += ` -> ${ep.outcome}`;
          if (ep.participants?.length > 0) {
            line += ` (${ep.participants.join(", ")})`;
          }
          return `- ${line}`;
        });

        const text = `EPISODES:\n${lines.join("\n")}`;
        return {
          content: [{ type: "text" as const, text }],
          details: { count: episodes.length },
        };
      } catch (err) {
        log.error(`episodes tool: ${(err as Error).message}`);
        return {
          content: [{
            type: "text" as const,
            text: `Failed to get episodes: ${(err as Error).message}`,
          }],
        };
      }
    },
  });
}

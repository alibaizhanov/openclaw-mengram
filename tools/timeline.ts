import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerTimelineTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_timeline",
    description:
      "Get a chronological timeline of memory events and changes. " +
      "Use to see what happened in a specific time period or to get " +
      "a chronological overview of stored memories.",
    parameters: Type.Object({
      after: Type.Optional(
        Type.String({ description: "ISO date — events after this date" }),
      ),
      before: Type.Optional(
        Type.String({ description: "ISO date — events before this date" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Max items (default: 20)" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { after?: string; before?: string; limit?: number },
    ) {
      try {
        const data = await client.getTimeline(
          params.after,
          params.before,
          params.limit ?? cfg.maxTimelineItems,
        );
        const results = data.results ?? [];

        if (results.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No timeline events found." }],
          };
        }

        const lines = results.map((ev) => {
          const date = (ev.event_date ?? ev.created_at ?? "").split("T")[0] || "unknown";
          return `- [${date}] ${ev.entity} (${ev.type}): ${ev.fact}`;
        });

        const text = `TIMELINE:\n${lines.join("\n")}`;
        return {
          content: [{ type: "text" as const, text }],
          details: { count: results.length },
        };
      } catch (err) {
        log.error(`timeline tool: ${(err as Error).message}`);
        return {
          content: [{
            type: "text" as const,
            text: `Failed to get timeline: ${(err as Error).message}`,
          }],
        };
      }
    },
  });
}

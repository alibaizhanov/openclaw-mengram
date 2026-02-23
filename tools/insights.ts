import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerInsightsTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  _cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_insights",
    description:
      "Get AI-generated insights and reflections about the user's memory. " +
      "Includes entity-level patterns, cross-entity connections, and temporal trends. " +
      "Use to understand deeper patterns in what the user has shared.",
    parameters: Type.Object({
      scope: Type.Optional(
        Type.String({
          description: "Filter scope: 'entity' (per-entity), 'cross' (cross-entity), 'temporal' (time-based)",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { scope?: string },
    ) {
      try {
        if (params.scope) {
          const data = await client.getReflections(params.scope);
          const reflections = data.reflections ?? [];

          if (reflections.length === 0) {
            return {
              content: [{
                type: "text" as const,
                text: `No ${params.scope} reflections found. Try running reflect() first.`,
              }],
            };
          }

          const lines = reflections.map((r) => {
            const date = r.created_at?.split("T")[0] ?? "";
            return `- [${date}] ${r.content}`;
          });

          const text = `REFLECTIONS (${params.scope}):\n${lines.join("\n")}`;
          return {
            content: [{ type: "text" as const, text }],
            details: { count: reflections.length },
          };
        }

        const data = await client.getInsights() as Record<string, unknown>;
        const text = JSON.stringify(data, null, 2);
        return {
          content: [{ type: "text" as const, text: `INSIGHTS:\n${text}` }],
        };
      } catch (err) {
        log.error(`insights tool: ${(err as Error).message}`);
        return {
          content: [{
            type: "text" as const,
            text: `Failed to get insights: ${(err as Error).message}`,
          }],
        };
      }
    },
  });
}

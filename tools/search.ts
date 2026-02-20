import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerSearchTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_search",
    description:
      "Search long-term memory for facts, past events, and learned workflows. " +
      "Use this to find what you know about the user, recall past conversations, " +
      "or look up procedures. Returns semantic facts, episodic events, and procedural workflows.",
    parameters: Type.Object({
      query: Type.String({ description: "Natural language search query" }),
      limit: Type.Optional(
        Type.Number({
          description: "Max results per memory type (default: 5)",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; limit?: number },
    ) {
      try {
        const data = await client.searchAll(
          params.query,
          params.limit ?? cfg.topK,
          cfg.graphDepth,
        );

        const parts: string[] = [];

        // Semantic
        if (data.semantic?.length > 0) {
          const lines: string[] = [];
          for (const r of data.semantic) {
            for (const f of r.facts.slice(0, cfg.maxFactsPerEntity)) {
              lines.push(`${r.entity}: ${f}`);
            }
            if (r.relations) {
              for (const rel of r.relations.slice(0, cfg.maxRelationsPerEntity)) {
                lines.push(
                  `${r.entity} -> ${rel.type} -> ${rel.target}`,
                );
              }
            }
          }
          if (lines.length > 0) {
            parts.push("FACTS:\n" + lines.map((l) => `- ${l}`).join("\n"));
          }
        }

        // Episodic
        if (data.episodic?.length > 0) {
          const lines = data.episodic.slice(0, cfg.maxEpisodes).map((ep) => {
            let line = ep.summary;
            if (ep.outcome) line += ` -> ${ep.outcome}`;
            return line;
          });
          parts.push("EVENTS:\n" + lines.map((l) => `- ${l}`).join("\n"));
        }

        // Procedural
        if (data.procedural?.length > 0) {
          const lines = data.procedural.slice(0, cfg.maxProcedures).map((pr) => {
            const steps = pr.steps
              .slice(0, cfg.maxStepsPerProcedure)
              .map((s) => s.action)
              .join(" -> ");
            const v = pr.version > 1 ? ` v${pr.version}` : "";
            return `${pr.name}${v} [${pr.id.slice(0, 8)}]: ${steps} (success: ${pr.success_count}, fail: ${pr.fail_count})`;
          });
          parts.push(
            "WORKFLOWS:\n" + lines.map((l) => `- ${l}`).join("\n"),
          );
        }

        const text =
          parts.length > 0
            ? parts.join("\n\n")
            : "No memories found for this query.";

        return {
          content: [{ type: "text" as const, text }],
          details: {
            semantic: data.semantic?.length ?? 0,
            episodic: data.episodic?.length ?? 0,
            procedural: data.procedural?.length ?? 0,
          },
        };
      } catch (err) {
        log.error(`search tool: ${(err as Error).message}`);
        return {
          content: [
            { type: "text" as const, text: `Memory search failed: ${(err as Error).message}` },
          ],
        };
      }
    },
  });
}

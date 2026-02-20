import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerSlashCommands(
  api: { registerCommand: (command: unknown) => void },
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  // /remember <text> — save to memory
  api.registerCommand({
    name: "remember",
    description: "Save text to long-term memory",
    acceptsArgs: true,
    handler: async (ctx: { args?: string }) => {
      const text = ctx.args?.trim();
      if (!text) {
        return { text: "Usage: /remember <text to save>" };
      }

      try {
        await client.addText(text);
        return { text: `Stored to memory: "${text.slice(0, 100)}${text.length > 100 ? "..." : ""}"` };
      } catch (err) {
        log.error(`/remember: ${(err as Error).message}`);
        return { text: `Failed to store: ${(err as Error).message}` };
      }
    },
  });

  // /recall <query> — search memory
  api.registerCommand({
    name: "recall",
    description: "Search long-term memory",
    acceptsArgs: true,
    handler: async (ctx: { args?: string }) => {
      const query = ctx.args?.trim();
      if (!query) {
        return { text: "Usage: /recall <search query>" };
      }

      try {
        const data = await client.searchAll(query, cfg.topK, cfg.graphDepth);

        const parts: string[] = [];

        if (data.semantic?.length > 0) {
          const lines: string[] = [];
          for (const r of data.semantic) {
            for (const f of r.facts.slice(0, cfg.maxFactsPerEntity)) {
              lines.push(`  ${r.entity}: ${f}`);
            }
          }
          if (lines.length > 0) parts.push(`Facts:\n${lines.join("\n")}`);
        }

        if (data.episodic?.length > 0) {
          const lines = data.episodic
            .slice(0, cfg.maxEpisodes)
            .map((ep) => `  ${ep.summary}`);
          parts.push(`Events:\n${lines.join("\n")}`);
        }

        if (data.procedural?.length > 0) {
          const lines = data.procedural
            .slice(0, cfg.maxProcedures)
            .map(
              (pr) =>
                `  ${pr.name} (v${pr.version}, ${pr.success_count}/${pr.success_count + pr.fail_count} success)`,
            );
          parts.push(`Workflows:\n${lines.join("\n")}`);
        }

        const text =
          parts.length > 0
            ? parts.join("\n\n")
            : "No memories found.";

        return { text };
      } catch (err) {
        log.error(`/recall: ${(err as Error).message}`);
        return { text: `Search failed: ${(err as Error).message}` };
      }
    },
  });

  // /forget <entity> — delete from memory
  api.registerCommand({
    name: "forget",
    description: "Delete an entity from long-term memory",
    acceptsArgs: true,
    handler: async (ctx: { args?: string }) => {
      const entity = ctx.args?.trim();
      if (!entity) {
        return { text: "Usage: /forget <entity name>" };
      }

      try {
        await client.deleteMemory(entity);
        return { text: `Deleted "${entity}" from memory.` };
      } catch (err) {
        log.error(`/forget: ${(err as Error).message}`);
        return { text: `Failed to delete: ${(err as Error).message}` };
      }
    },
  });
}

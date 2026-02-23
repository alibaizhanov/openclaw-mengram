import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerTriggersTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_triggers",
    description:
      "Get pending smart triggers — reminders, detected contradictions, " +
      "and behavioral patterns. Use proactively to check if there are " +
      "things the user should be reminded about or issues to address.",
    parameters: Type.Object({
      include_fired: Type.Optional(
        Type.Boolean({ description: "Include already-fired triggers (default: false)" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { include_fired?: boolean },
    ) {
      try {
        const data = await client.getTriggers(
          params.include_fired ?? false,
          cfg.maxTriggers,
        );
        const triggers = data.triggers ?? [];

        if (triggers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No pending triggers." }],
          };
        }

        const groups: Record<string, string[]> = {};
        for (const t of triggers) {
          const type = t.trigger_type || "other";
          if (!groups[type]) groups[type] = [];
          let line = t.title;
          if (t.detail) line += ` — ${t.detail}`;
          if (t.fire_at) line += ` (due: ${t.fire_at.split("T")[0]})`;
          if (t.fired) line += " [fired]";
          groups[type].push(`- ${line}`);
        }

        const sections = Object.entries(groups).map(
          ([type, lines]) => `${type.toUpperCase()}:\n${lines.join("\n")}`,
        );

        const text = sections.join("\n\n");
        return {
          content: [{ type: "text" as const, text }],
          details: { count: triggers.length },
        };
      } catch (err) {
        log.error(`triggers tool: ${(err as Error).message}`);
        return {
          content: [{
            type: "text" as const,
            text: `Failed to get triggers: ${(err as Error).message}`,
          }],
        };
      }
    },
  });
}

import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerAgentsTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  _cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_agents",
    description:
      "Run memory maintenance agents to improve memory quality. " +
      "Agents: 'curator' (fixes bad facts), 'connector' (finds relations), " +
      "'digest' (generates summaries), 'all' (run everything).",
    parameters: Type.Object({
      agent: Type.Optional(
        Type.String({
          description: "Agent to run: 'curator', 'connector', 'digest', or 'all' (default: 'all')",
        }),
      ),
      auto_fix: Type.Optional(
        Type.Boolean({ description: "Auto-archive bad facts (default: false)" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { agent?: string; auto_fix?: boolean },
    ) {
      try {
        const result = await client.runAgents(
          params.agent ?? "all",
          params.auto_fix ?? false,
        );

        const parts: string[] = [`Status: ${result.status}`];

        if (result.agents) {
          for (const [name, data] of Object.entries(result.agents)) {
            parts.push(`${name}: ${JSON.stringify(data)}`);
          }
        } else if (result.result) {
          parts.push(JSON.stringify(result.result));
        }

        const text = `AGENT RESULTS:\n${parts.join("\n")}`;
        return {
          content: [{ type: "text" as const, text }],
          details: { status: result.status },
        };
      } catch (err) {
        log.error(`agents tool: ${(err as Error).message}`);
        return {
          content: [{
            type: "text" as const,
            text: `Failed to run agents: ${(err as Error).message}`,
          }],
        };
      }
    },
  });
}

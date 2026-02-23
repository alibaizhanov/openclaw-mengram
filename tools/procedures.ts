import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerProceduresTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_procedures",
    description:
      "List or search learned workflows (procedures) with success/failure tracking. " +
      "Procedures are multi-step workflows that self-improve — when they fail, they " +
      "automatically evolve to a better version. Use to find a known workflow before " +
      "attempting a task.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description:
            "Search query to find specific procedures (omit to list all)",
        }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Max results (default: 10)" }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query?: string; limit?: number },
    ) {
      try {
        const data = await client.getProcedures(
          params.query,
          params.limit ?? 10,
        );

        const procedures = data.procedures ?? data.results ?? [];

        if (procedures.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: params.query
                  ? `No workflows found matching "${params.query}".`
                  : "No learned workflows yet.",
              },
            ],
          };
        }

        const lines = procedures.map((pr) => {
          const steps = pr.steps
            .slice(0, cfg.maxStepsPerProcedure)
            .map((s) => `${s.step ?? ""}. ${s.action}`)
            .join("\n    ");
          const v = pr.version > 1 ? ` (v${pr.version})` : "";
          return (
            `${pr.name}${v} [${pr.id.slice(0, 8)}]\n` +
            `  Success: ${pr.success_count} | Fail: ${pr.fail_count}\n` +
            `  Trigger: ${pr.trigger_condition ?? "manual"}\n` +
            `  Steps:\n    ${steps}`
          );
        });

        return {
          content: [
            { type: "text" as const, text: lines.join("\n\n") },
          ],
          details: { count: procedures.length },
        };
      } catch (err) {
        log.error(`procedures tool: ${(err as Error).message}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list procedures: ${(err as Error).message}`,
            },
          ],
        };
      }
    },
  });
}

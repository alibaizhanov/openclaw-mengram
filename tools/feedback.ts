import { Type } from "@sinclair/typebox";
import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerFeedbackTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  _cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_feedback",
    description:
      "Record success or failure for a known procedure (workflow). On failure with " +
      "context, the procedure automatically evolves — AI analyzes what went wrong " +
      "and creates an improved version. Use after completing a task that followed a " +
      "known workflow from memory_procedures or memory_search.",
    parameters: Type.Object({
      procedure_id: Type.String({
        description:
          "Procedure ID (the 8-char code shown in search/procedures results, or full UUID)",
      }),
      success: Type.Boolean({
        description: "true if the workflow succeeded, false if it failed",
      }),
      context: Type.Optional(
        Type.String({
          description:
            "What went wrong (required for failure — triggers automatic evolution)",
        }),
      ),
      failed_at_step: Type.Optional(
        Type.Number({
          description: "Which step number failed (1-indexed)",
        }),
      ),
    }),
    async execute(
      _toolCallId: string,
      params: {
        procedure_id: string;
        success: boolean;
        context?: string;
        failed_at_step?: number;
      },
    ) {
      try {
        const result = await client.procedureFeedback(
          params.procedure_id,
          params.success,
          params.context,
          params.failed_at_step,
        );

        const status = params.success ? "Success" : "Failure";
        let text = `${status} recorded for "${result.name}" (success: ${result.success_count}, fail: ${result.fail_count})`;

        if (result.evolution_triggered) {
          text +=
            "\nProcedure evolution triggered — an improved version is being created.";
        }

        return {
          content: [{ type: "text" as const, text }],
          details: {
            evolution_triggered: result.evolution_triggered,
            feedback: result.feedback,
          },
        };
      } catch (err) {
        log.error(`feedback tool: ${(err as Error).message}`);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to record feedback: ${(err as Error).message}`,
            },
          ],
        };
      }
    },
  });
}

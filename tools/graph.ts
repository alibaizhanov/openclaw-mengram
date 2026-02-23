import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerGraphTool(
  api: { registerTool: (tool: unknown) => void },
  client: MengramClient,
  _cfg: MengramConfig,
  log: Logger,
) {
  api.registerTool({
    name: "memory_graph",
    description:
      "Get the knowledge graph showing entities and their relationships. " +
      "Use to understand how different memories are connected.",
    parameters: {},
    async execute(_toolCallId: string) {
      try {
        const data = await client.getGraph();
        const nodes = data.nodes ?? [];
        const edges = data.edges ?? [];

        if (nodes.length === 0) {
          return {
            content: [{ type: "text" as const, text: "Knowledge graph is empty." }],
          };
        }

        const parts: string[] = [
          `KNOWLEDGE GRAPH: ${nodes.length} entities, ${edges.length} connections`,
          "",
          "ENTITIES:",
        ];

        for (const node of nodes.slice(0, 30)) {
          const facts = node.facts_count ? ` (${node.facts_count} facts)` : "";
          parts.push(`- ${node.name} [${node.type}]${facts}`);
        }
        if (nodes.length > 30) {
          parts.push(`  ... and ${nodes.length - 30} more`);
        }

        if (edges.length > 0) {
          parts.push("", "CONNECTIONS:");
          for (const edge of edges.slice(0, 30)) {
            parts.push(`- ${edge.source} -> ${edge.type} -> ${edge.target}`);
          }
          if (edges.length > 30) {
            parts.push(`  ... and ${edges.length - 30} more`);
          }
        }

        const text = parts.join("\n");
        return {
          content: [{ type: "text" as const, text }],
          details: { nodes: nodes.length, edges: edges.length },
        };
      } catch (err) {
        log.error(`graph tool: ${(err as Error).message}`);
        return {
          content: [{
            type: "text" as const,
            text: `Failed to get graph: ${(err as Error).message}`,
          }],
        };
      }
    },
  });
}

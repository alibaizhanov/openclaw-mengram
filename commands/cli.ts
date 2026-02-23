import type { MengramClient } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

export function registerCli(
  api: { registerCli: (handler: unknown, opts?: { commands?: string[] }) => void },
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  api.registerCli(
    ({ program }: { program: { command: (...args: unknown[]) => unknown } }) => {
      const mengram = (program.command as Function)("mengram") as {
        description: (d: string) => unknown;
        command: (name: string) => {
          description: (d: string) => unknown;
          argument: (name: string, desc: string) => unknown;
          option: (flag: string, desc: string, def?: string) => unknown;
          action: (fn: Function) => unknown;
        };
      };
      mengram.description("Mengram memory commands");

      // openclaw mengram search <query>
      const search = mengram.command("search");
      search.description("Search all 3 memory types");
      search.argument("<query>", "Search query");
      search.option("--limit <n>", "Max results", "5");
      search.action(async (query: string, opts: { limit: string }) => {
        try {
          const data = await client.searchAll(
            query,
            parseInt(opts.limit) || cfg.topK,
            cfg.graphDepth,
          );

          console.log("\n=== Semantic ===");
          for (const r of data.semantic || []) {
            console.log(`  ${r.entity} (${r.type}, score: ${r.score.toFixed(3)})`);
            for (const f of r.facts.slice(0, cfg.maxFactsPerEntity)) {
              console.log(`    - ${f}`);
            }
          }

          console.log("\n=== Episodic ===");
          for (const ep of data.episodic || []) {
            const date = ep.created_at?.split("T")[0] ?? "";
            console.log(`  ${ep.summary} (${date})`);
          }

          console.log("\n=== Procedural ===");
          for (const pr of data.procedural || []) {
            const v = pr.version > 1 ? ` v${pr.version}` : "";
            console.log(
              `  ${pr.name}${v} (${pr.success_count}/${pr.success_count + pr.fail_count} success)`,
            );
          }

          const total =
            (data.semantic?.length ?? 0) +
            (data.episodic?.length ?? 0) +
            (data.procedural?.length ?? 0);
          console.log(`\n${total} results found.\n`);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram stats
      const stats = mengram.command("stats");
      stats.description("Show memory usage statistics");
      stats.action(async () => {
        try {
          const s = await client.getStats();
          console.log("\n=== Mengram Stats ===");
          console.log(`  Entities:    ${s.entities}`);
          console.log(`  Facts:       ${s.facts}`);
          console.log(`  Knowledge:   ${s.knowledge}`);
          console.log(`  Relations:   ${s.relations}`);
          console.log(`  Embeddings:  ${s.embeddings}`);
          if (s.by_type && Object.keys(s.by_type).length > 0) {
            console.log("  By type:");
            for (const [type, count] of Object.entries(s.by_type)) {
              console.log(`    ${type}: ${count}`);
            }
          }
          console.log();
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram profile
      const profile = mengram.command("profile");
      profile.description("Show cognitive profile");
      profile.option("--force", "Force regenerate");
      profile.action(async (opts: { force?: boolean }) => {
        try {
          const p = await client.getProfile("default", opts.force ?? false);
          if (p.status === "ok") {
            console.log(`\n${p.system_prompt}\n`);
            console.log(`  Facts used: ${p.facts_used}`);
            console.log(`  Last updated: ${p.last_updated ?? "never"}\n`);
          } else {
            console.log(`\nProfile status: ${p.status}`);
            if (p.error) console.log(`Error: ${p.error}`);
            console.log();
          }
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram procedures
      const procedures = mengram.command("procedures");
      procedures.description("List learned workflows");
      procedures.option("--query <q>", "Search procedures");
      procedures.option("--limit <n>", "Max results", "20");
      procedures.action(async (opts: { query?: string; limit: string }) => {
        try {
          const data = await client.getProcedures(
            opts.query,
            parseInt(opts.limit) || 20,
          );

          const procs = data.procedures ?? data.results ?? [];
          if (procs.length === 0) {
            console.log("\nNo procedures found.\n");
            return;
          }

          console.log("\n=== Procedures ===");
          for (const pr of procs) {
            const v = pr.version > 1 ? ` (v${pr.version})` : "";
            console.log(
              `\n  ${pr.name}${v} [${pr.id.slice(0, 8)}]`,
            );
            console.log(
              `  Success: ${pr.success_count} | Fail: ${pr.fail_count}`,
            );
            for (const s of pr.steps.slice(0, cfg.maxStepsPerProcedure)) {
              console.log(`    ${s.step ?? "-"}. ${s.action}`);
            }
          }
          console.log();
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram episodes
      const episodes = mengram.command("episodes");
      episodes.description("List or search episodic memories");
      episodes.option("--query <q>", "Search query");
      episodes.option("--limit <n>", "Max results", "20");
      episodes.option("--after <date>", "After ISO date");
      episodes.option("--before <date>", "Before ISO date");
      episodes.action(async (opts: { query?: string; limit: string; after?: string; before?: string }) => {
        try {
          let items: Array<{ id: string; summary: string; outcome?: string | null; participants: string[]; created_at: string }>;

          if (opts.query) {
            const data = await client.searchEpisodes(
              opts.query,
              parseInt(opts.limit) || 20,
              opts.after,
              opts.before,
            );
            items = data.results ?? [];
          } else {
            const data = await client.getEpisodes(
              parseInt(opts.limit) || 20,
              opts.after,
              opts.before,
            );
            items = data.episodes ?? [];
          }

          if (items.length === 0) {
            console.log("\nNo episodes found.\n");
            return;
          }

          console.log("\n=== Episodes ===");
          for (const ep of items) {
            const date = ep.created_at?.split("T")[0] ?? "";
            let line = `  [${date}] ${ep.summary}`;
            if (ep.outcome) line += ` -> ${ep.outcome}`;
            if (ep.participants?.length > 0) line += ` (${ep.participants.join(", ")})`;
            console.log(line);
          }
          console.log(`\n${items.length} episodes.\n`);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram agents
      const agents = mengram.command("agents");
      agents.description("Run memory maintenance agents");
      agents.option("--agent <name>", "Agent: curator, connector, digest, all", "all");
      agents.option("--auto-fix", "Auto-archive bad facts");
      agents.action(async (opts: { agent: string; autoFix?: boolean }) => {
        try {
          console.log(`\nRunning ${opts.agent} agent(s)...`);
          const result = await client.runAgents(opts.agent, opts.autoFix ?? false);
          console.log(`Status: ${result.status}`);
          if (result.agents) {
            for (const [name, data] of Object.entries(result.agents)) {
              console.log(`  ${name}: ${JSON.stringify(data)}`);
            }
          }
          console.log();
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram triggers
      const triggers = mengram.command("triggers");
      triggers.description("List smart triggers (reminders, contradictions, patterns)");
      triggers.option("--include-fired", "Include already-fired triggers");
      triggers.option("--limit <n>", "Max triggers", "50");
      triggers.action(async (opts: { includeFired?: boolean; limit: string }) => {
        try {
          const data = await client.getTriggers(
            opts.includeFired ?? false,
            parseInt(opts.limit) || 50,
          );
          const items = data.triggers ?? [];

          if (items.length === 0) {
            console.log("\nNo triggers found.\n");
            return;
          }

          console.log("\n=== Triggers ===");
          for (const t of items) {
            let line = `  [${t.trigger_type}] ${t.title}`;
            if (t.detail) line += ` — ${t.detail}`;
            if (t.fire_at) line += ` (due: ${t.fire_at.split("T")[0]})`;
            if (t.fired) line += " [fired]";
            console.log(line);
          }
          console.log(`\n${items.length} triggers.\n`);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram insights
      const insights = mengram.command("insights");
      insights.description("Show AI-generated insights and reflections");
      insights.option("--scope <s>", "Filter: entity, cross, temporal");
      insights.action(async (opts: { scope?: string }) => {
        try {
          if (opts.scope) {
            const data = await client.getReflections(opts.scope);
            const items = data.reflections ?? [];
            if (items.length === 0) {
              console.log(`\nNo ${opts.scope} reflections found.\n`);
              return;
            }
            console.log(`\n=== Reflections (${opts.scope}) ===`);
            for (const r of items) {
              const date = r.created_at?.split("T")[0] ?? "";
              console.log(`  [${date}] ${r.content}`);
            }
            console.log();
          } else {
            const data = await client.getInsights();
            console.log("\n=== Insights ===");
            console.log(JSON.stringify(data, null, 2));
            console.log();
          }
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram timeline
      const timeline = mengram.command("timeline");
      timeline.description("Show chronological timeline of memory events");
      timeline.option("--after <date>", "After ISO date");
      timeline.option("--before <date>", "Before ISO date");
      timeline.option("--limit <n>", "Max items", "20");
      timeline.action(async (opts: { after?: string; before?: string; limit: string }) => {
        try {
          const data = await client.getTimeline(
            opts.after,
            opts.before,
            parseInt(opts.limit) || 20,
          );
          const items = data.results ?? [];

          if (items.length === 0) {
            console.log("\nNo timeline events found.\n");
            return;
          }

          console.log("\n=== Timeline ===");
          for (const ev of items) {
            const date = (ev.event_date ?? ev.created_at ?? "").split("T")[0] || "?";
            console.log(`  [${date}] ${ev.entity} (${ev.type}): ${ev.fact}`);
          }
          console.log(`\n${items.length} events.\n`);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram graph
      const graph = mengram.command("graph");
      graph.description("Show knowledge graph");
      graph.action(async () => {
        try {
          const data = await client.getGraph();
          const nodes = data.nodes ?? [];
          const edges = data.edges ?? [];

          console.log(`\n=== Knowledge Graph: ${nodes.length} entities, ${edges.length} connections ===`);
          for (const n of nodes.slice(0, 50)) {
            const facts = n.facts_count ? ` (${n.facts_count} facts)` : "";
            console.log(`  ${n.name} [${n.type}]${facts}`);
          }
          if (nodes.length > 50) console.log(`  ... and ${nodes.length - 50} more`);

          if (edges.length > 0) {
            console.log("\n  Connections:");
            for (const e of edges.slice(0, 30)) {
              console.log(`    ${e.source} -> ${e.type} -> ${e.target}`);
            }
            if (edges.length > 30) console.log(`    ... and ${edges.length - 30} more`);
          }
          console.log();
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram feed
      const feed = mengram.command("feed");
      feed.description("Show memory activity feed");
      feed.option("--limit <n>", "Max items", "20");
      feed.action(async (opts: { limit: string }) => {
        try {
          const data = await client.getFeed(parseInt(opts.limit) || 20);
          const items = (data.feed ?? []) as Array<Record<string, unknown>>;

          if (items.length === 0) {
            console.log("\nNo feed items.\n");
            return;
          }

          console.log("\n=== Feed ===");
          for (const item of items) {
            const date = String(item.created_at ?? "").split("T")[0] || "?";
            const action = item.action ?? item.type ?? "event";
            const entity = item.entity ?? "";
            const detail = item.detail ?? item.fact ?? "";
            console.log(`  [${date}] ${action}: ${entity} ${detail}`);
          }
          console.log(`\n${items.length} items.\n`);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram reindex
      const reindex = mengram.command("reindex");
      reindex.description("Reindex all memory embeddings");
      reindex.action(async () => {
        try {
          console.log("\nReindexing...");
          const result = await client.reindex();
          console.log(`Done. Reindexed ${result.reindexed} embeddings.\n`);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram dedup
      const dedup = mengram.command("dedup");
      dedup.description("Deduplicate memories");
      dedup.option("--all", "Deduplicate facts across all entities");
      dedup.action(async (opts: { all?: boolean }) => {
        try {
          console.log("\nDeduplicating...");
          if (opts.all) {
            const result = await client.dedupAll();
            console.log(`Done. Archived ${result.total_archived} duplicate facts.\n`);
          } else {
            const result = await client.dedup();
            console.log(`Done. Merged ${result.count} duplicate entities.\n`);
          }
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });

      // openclaw mengram merge <source> <target>
      const merge = mengram.command("merge");
      merge.description("Merge two entities into one");
      merge.argument("<source>", "Entity to merge from");
      merge.argument("<target>", "Entity to merge into");
      merge.action(async (source: string, target: string) => {
        try {
          console.log(`\nMerging "${source}" into "${target}"...`);
          const result = await client.merge(source, target);
          console.log(`Status: ${result.status}. ${result.from} -> ${result.into}\n`);
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
        }
      });
    },
    { commands: ["mengram"] },
  );
}

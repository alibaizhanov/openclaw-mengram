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
          action: (fn: (...args: unknown[]) => unknown) => unknown;
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
    },
    { commands: ["mengram"] },
  );
}

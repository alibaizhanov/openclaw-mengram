import type {
  MengramClient,
  SearchAllResponse,
  SemanticResult,
  EpisodicResult,
  ProceduralResult,
} from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

const turnCounters = new Map<string, number>();

function formatSemantic(results: SemanticResult[], cfg: MengramConfig): string {
  const lines: string[] = [];

  for (const r of results) {
    if (r.facts.length > 0) {
      for (const fact of r.facts.slice(0, cfg.maxFactsPerEntity)) {
        lines.push(`- ${r.entity}: ${fact}`);
      }
    }
  }

  if (lines.length === 0) return "";
  return `KNOWN FACTS:\n${lines.join("\n")}`;
}

function formatRelations(results: SemanticResult[], cfg: MengramConfig): string {
  const lines: string[] = [];

  for (const r of results) {
    if (!r.relations || r.relations.length === 0) continue;
    for (const rel of r.relations.slice(0, cfg.maxRelationsPerEntity)) {
      const arrow = rel.direction === "outgoing" ? "->" : "<-";
      lines.push(`- ${r.entity} ${arrow} ${rel.type} ${arrow} ${rel.target}`);
    }
  }

  if (lines.length === 0) return "";
  return `RELATIONSHIPS:\n${lines.join("\n")}`;
}

function formatEpisodic(results: EpisodicResult[], cfg: MengramConfig): string {
  const lines: string[] = [];

  for (const ep of results.slice(0, cfg.maxEpisodes)) {
    let line = ep.summary;
    if (ep.outcome) line += ` -> ${ep.outcome}`;
    if (ep.created_at) {
      const date = ep.created_at.split("T")[0];
      line += ` (${date})`;
    }
    lines.push(`- ${line}`);
  }

  if (lines.length === 0) return "";
  return `PAST EVENTS:\n${lines.join("\n")}`;
}

function formatProcedural(results: ProceduralResult[], cfg: MengramConfig): string {
  const lines: string[] = [];

  for (const pr of results.slice(0, cfg.maxProcedures)) {
    const steps = pr.steps
      .slice(0, cfg.maxStepsPerProcedure)
      .map((s) => s.action)
      .join(" -> ");
    const vTag = pr.version > 1 ? ` v${pr.version}` : "";
    const stats = `success: ${pr.success_count}, fail: ${pr.fail_count}`;
    const pid = pr.id.slice(0, 8);
    lines.push(`- ${pr.name}${vTag} [${pid}]: ${steps} (${stats})`);
  }

  if (lines.length === 0) return "";
  return `KNOWN WORKFLOWS:\n${lines.join("\n")}`;
}

function formatSearchResults(data: SearchAllResponse, cfg: MengramConfig): string {
  const parts: string[] = [];

  const semantic = formatSemantic(data.semantic || [], cfg);
  if (semantic) parts.push(semantic);

  const relations = formatRelations(data.semantic || [], cfg);
  if (relations) parts.push(relations);

  const episodic = formatEpisodic(data.episodic || [], cfg);
  if (episodic) parts.push(episodic);

  const procedural = formatProcedural(data.procedural || [], cfg);
  if (procedural) parts.push(procedural);

  return parts.join("\n\n");
}

export function buildRecallHandler(
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  return async (
    event: Record<string, unknown>,
    ctx: Record<string, unknown>,
  ): Promise<{ prependContext: string } | void> => {
    const prompt = event.prompt as string | undefined;
    if (!prompt || prompt.trim().length === 0) return;

    const sessionKey = (ctx.sessionKey as string) ?? "default";

    try {
      log.debug(`recall: searching for "${prompt.slice(0, 80)}"`);

      const data = await client.searchAll(prompt, cfg.topK, cfg.graphDepth);

      const memoryContext = formatSearchResults(data, cfg);

      // Inject cognitive profile periodically
      let profileContext = "";
      if (cfg.injectProfile) {
        const count = (turnCounters.get(sessionKey) ?? 0) + 1;
        turnCounters.set(sessionKey, count);

        if (count === 1 || count % cfg.profileFrequency === 0) {
          try {
            const profile = await client.getProfile();
            if (profile.status === "ok" && profile.system_prompt) {
              profileContext = `USER PROFILE:\n${profile.system_prompt}`;
            }
          } catch {
            log.debug("recall: profile fetch failed, skipping");
          }
        }
      }

      const sections: string[] = [];
      if (profileContext) sections.push(profileContext);
      if (memoryContext) sections.push(memoryContext);

      if (sections.length === 0) {
        log.debug("recall: no memories found");
        return;
      }

      const context = sections.join("\n\n");
      log.debug(`recall: injecting ${context.length} chars of context`);

      return {
        prependContext: `<mengram-memories>\n${context}\n</mengram-memories>`,
      };
    } catch (err) {
      log.error(`recall: ${(err as Error).message}`);
      return;
    }
  };
}

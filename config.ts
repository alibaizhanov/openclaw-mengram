export interface MengramConfig {
  apiKey: string;
  baseUrl: string;
  autoRecall: boolean;
  autoCapture: boolean;
  topK: number;
  graphDepth: number;
  injectProfile: boolean;
  profileFrequency: number;
  debug: boolean;
  maxFactsPerEntity: number;
  maxRelationsPerEntity: number;
  maxEpisodes: number;
  maxProcedures: number;
  maxStepsPerProcedure: number;
  captureMessageCount: number;
  requestTimeout: number;
  maxTriggers: number;
  maxTimelineItems: number;
}

function resolveEnv(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^\$\{(\w+)\}$/);
  if (match) return process.env[match[1]];
  return value;
}

function num(val: unknown, fallback: number): number {
  return typeof val === "number" && val > 0 ? val : fallback;
}

export function parseConfig(raw: unknown): MengramConfig {
  const cfg = (raw ?? {}) as Record<string, unknown>;

  return {
    apiKey: resolveEnv(cfg.apiKey) ?? process.env.MENGRAM_API_KEY ?? "",
    baseUrl: (resolveEnv(cfg.baseUrl) ?? "https://mengram.io").replace(
      /\/$/,
      "",
    ),
    autoRecall: cfg.autoRecall !== false,
    autoCapture: cfg.autoCapture !== false,
    topK: num(cfg.topK, 5),
    graphDepth: typeof cfg.graphDepth === "number" ? cfg.graphDepth : 2,
    injectProfile: cfg.injectProfile === true,
    profileFrequency: num(cfg.profileFrequency, 25),
    debug: cfg.debug === true,
    maxFactsPerEntity: num(cfg.maxFactsPerEntity, 5),
    maxRelationsPerEntity: num(cfg.maxRelationsPerEntity, 5),
    maxEpisodes: num(cfg.maxEpisodes, 5),
    maxProcedures: num(cfg.maxProcedures, 3),
    maxStepsPerProcedure: num(cfg.maxStepsPerProcedure, 8),
    captureMessageCount: num(cfg.captureMessageCount, 10),
    requestTimeout: num(cfg.requestTimeout, 15000),
    maxTriggers: num(cfg.maxTriggers, 10),
    maxTimelineItems: num(cfg.maxTimelineItems, 20),
  };
}

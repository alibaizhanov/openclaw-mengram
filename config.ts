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
}

function resolveEnv(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/^\$\{(\w+)\}$/);
  if (match) return process.env[match[1]];
  return value;
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
    topK: typeof cfg.topK === "number" ? cfg.topK : 5,
    graphDepth: typeof cfg.graphDepth === "number" ? cfg.graphDepth : 2,
    injectProfile: cfg.injectProfile === true,
    profileFrequency:
      typeof cfg.profileFrequency === "number" ? cfg.profileFrequency : 25,
    debug: cfg.debug === true,
  };
}

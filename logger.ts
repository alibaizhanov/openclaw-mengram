import type { MengramConfig } from "./config.ts";

export interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string) => void;
}

export function initLogger(
  pluginLogger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, ...args: unknown[]) => void;
    debug?: (msg: string) => void;
  },
  cfg: MengramConfig,
): Logger {
  const prefix = "mengram:";
  return {
    info: (msg: string) => pluginLogger.info(`${prefix} ${msg}`),
    warn: (msg: string) => pluginLogger.warn(`${prefix} ${msg}`),
    error: (msg: string, ...args: unknown[]) =>
      pluginLogger.error(`${prefix} ${msg}`, ...args),
    debug: (msg: string) => {
      if (cfg.debug && pluginLogger.debug) {
        pluginLogger.debug(`${prefix} ${msg}`);
      }
    },
  };
}

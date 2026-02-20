import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { MengramClient } from "./client.ts";
import { parseConfig } from "./config.ts";
import { initLogger } from "./logger.ts";
import { buildRecallHandler } from "./hooks/recall.ts";
import { buildCaptureHandler } from "./hooks/capture.ts";
import { registerSearchTool } from "./tools/search.ts";
import { registerStoreTool } from "./tools/store.ts";
import { registerForgetTool } from "./tools/forget.ts";
import { registerProfileTool } from "./tools/profile.ts";
import { registerProceduresTool } from "./tools/procedures.ts";
import { registerFeedbackTool } from "./tools/feedback.ts";
import { registerSlashCommands } from "./commands/slash.ts";
import { registerCli } from "./commands/cli.ts";

export default {
  id: "openclaw-mengram",
  name: "Mengram",
  description:
    "Human-like long-term memory — semantic facts, episodic events, " +
    "and self-improving procedural workflows with Graph RAG",
  kind: "memory" as const,

  register(api: OpenClawPluginApi) {
    const cfg = parseConfig(api.pluginConfig);
    const log = initLogger(api.logger, cfg);

    if (!cfg.apiKey) {
      log.warn(
        "no API key configured — set apiKey in plugin config or MENGRAM_API_KEY env var. " +
          "Get a free key at https://mengram.io",
      );

      // Register stub slash commands so user gets helpful error messages
      api.registerCommand({
        name: "remember",
        description: "Save to memory (not configured)",
        handler: () => ({
          text: "Mengram not configured. Set your API key in plugin config or MENGRAM_API_KEY env var.",
        }),
      });
      api.registerCommand({
        name: "recall",
        description: "Search memory (not configured)",
        handler: () => ({
          text: "Mengram not configured. Set your API key in plugin config or MENGRAM_API_KEY env var.",
        }),
      });
      return;
    }

    const client = new MengramClient(cfg.apiKey, cfg.baseUrl, cfg.requestTimeout);

    log.info("connected");

    // Register 6 tools
    registerSearchTool(api, client, cfg, log);
    registerStoreTool(api, client, cfg, log);
    registerForgetTool(api, client, cfg, log);
    registerProfileTool(api, client, cfg, log);
    registerProceduresTool(api, client, cfg, log);
    registerFeedbackTool(api, client, cfg, log);

    // Auto-recall: inject memories before each agent turn
    if (cfg.autoRecall) {
      api.on(
        "before_agent_start",
        buildRecallHandler(client, cfg, log) as (
          ...args: unknown[]
        ) => unknown,
      );
      log.info("auto-recall enabled");
    }

    // Auto-capture: store memories after each agent turn
    if (cfg.autoCapture) {
      api.on(
        "agent_end",
        buildCaptureHandler(client, cfg, log) as (
          ...args: unknown[]
        ) => unknown,
      );
      log.info("auto-capture enabled");
    }

    // Slash commands: /remember, /recall, /forget
    registerSlashCommands(api, client, cfg, log);

    // CLI: openclaw mengram search/stats/profile/procedures
    registerCli(api, client, cfg, log);

    // Service lifecycle
    api.registerService({
      id: "openclaw-mengram",
      start: () => log.info("service started"),
      stop: () => log.info("service stopped"),
    });
  },
};

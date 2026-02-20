declare module "openclaw/plugin-sdk" {
  export interface OpenClawPluginApi {
    pluginConfig: unknown;
    logger: {
      info: (msg: string) => void;
      warn: (msg: string) => void;
      error: (msg: string, ...args: unknown[]) => void;
      debug?: (msg: string) => void;
    };
    registerTool(tool: unknown, options?: unknown): void;
    registerCommand(command: unknown): void;
    registerCli(handler: unknown, options?: { commands?: string[] }): void;
    registerService(service: {
      id: string;
      start: (ctx: unknown) => void | Promise<void>;
      stop?: (ctx: unknown) => void | Promise<void>;
    }): void;
    on(
      event: string,
      handler: (...args: unknown[]) => unknown,
      opts?: { priority?: number },
    ): void;
  }

  export function stringEnum(values: readonly string[]): unknown;
}

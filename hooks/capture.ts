import type { MengramClient, Message } from "../client.ts";
import type { MengramConfig } from "../config.ts";
import type { Logger } from "../logger.ts";

const MEMORY_TAG_RE = /<mengram-memories>[\s\S]*?<\/mengram-memories>/g;

function stripInjectedContext(content: string): string {
  return content.replace(MEMORY_TAG_RE, "").trim();
}

function extractMessages(
  raw: unknown[],
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  for (const msg of raw) {
    if (msg == null || typeof msg !== "object") continue;
    const m = msg as Record<string, unknown>;

    const role = m.role as string | undefined;
    const content = m.content as string | undefined;
    if (!role || !content) continue;

    messages.push({ role, content });
  }

  return messages;
}

export function buildCaptureHandler(
  client: MengramClient,
  cfg: MengramConfig,
  log: Logger,
) {
  return async (
    event: Record<string, unknown>,
  ): Promise<void> => {
    if (event.success === false) {
      log.debug("capture: skipping failed turn");
      return;
    }

    const rawMessages = event.messages as unknown[] | undefined;
    if (!rawMessages || rawMessages.length === 0) {
      log.debug("capture: no messages to capture");
      return;
    }

    try {
      // Take last 10 messages
      const recent = extractMessages(rawMessages).slice(-cfg.captureMessageCount);
      if (recent.length === 0) return;

      // Strip injected memory context to prevent recursion
      const cleaned: Message[] = recent.map((m) => ({
        role: m.role as Message["role"],
        content: stripInjectedContext(m.content),
      }));

      // Filter out empty messages after stripping
      const nonEmpty = cleaned.filter((m) => m.content.length > 0);
      if (nonEmpty.length === 0) return;

      log.debug(`capture: storing ${nonEmpty.length} messages`);

      await client.add(nonEmpty);

      log.debug("capture: stored successfully");
    } catch (err) {
      log.error(`capture: ${(err as Error).message}`);
    }
  };
}

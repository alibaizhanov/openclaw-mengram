# Mengram — OpenClaw Memory Plugin

Human-like long-term memory for your OpenClaw agent. Three memory types that work together, with automatic recall and capture on every turn.

## What It Does

| Without Mengram | With Mengram |
|---|---|
| "Which restaurant?" | "Booking Kaganat at 7pm for 2. Vegan menu for Anya?" |
| New session = blank slate | Knows your preferences, history, workflows |
| Same as day 1 after 100 chats | Deep understanding of who you are |

**Memory types:**
- **Semantic** — facts: preferences, relationships, habits
- **Episodic** — events with timestamps and outcomes
- **Procedural** — learned workflows that self-improve from failures
- **Graph RAG** — 2-hop knowledge graph traversal connects related memories

**Auto-recall:** Before every agent turn, relevant memories are injected into context. No manual tool calls needed.

**Auto-capture:** After every turn, new information is automatically extracted and stored. Nothing is lost.

## Install

```bash
openclaw plugins install @mengram/openclaw-mengram
```

## Setup

1. Get a free API key at [mengram.io](https://mengram.io)

2. Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "openclaw-mengram": {
        "enabled": true,
        "config": {
          "apiKey": "${MENGRAM_API_KEY}"
        }
      }
    },
    "slots": {
      "memory": "openclaw-mengram"
    }
  }
}
```

3. Set your API key:

```bash
export MENGRAM_API_KEY="om-your-key-here"
```

4. Restart OpenClaw. Memory works automatically.

## Configuration

| Option | Default | Description |
|---|---|---|
| `apiKey` | `$MENGRAM_API_KEY` | API key from mengram.io |
| `baseUrl` | `https://mengram.io` | Custom URL for self-hosted |
| `autoRecall` | `true` | Inject memories before each turn |
| `autoCapture` | `true` | Store memories after each turn |
| `topK` | `5` | Max results per search |
| `graphDepth` | `2` | Knowledge graph hops (0=off, 1, 2) |
| `injectProfile` | `false` | Include cognitive profile periodically |
| `profileFrequency` | `25` | Profile injection every N turns |
| `debug` | `false` | Verbose logging |

## Tools

The agent can also use these tools explicitly:

| Tool | Purpose |
|---|---|
| `memory_search` | Search all 3 memory types |
| `memory_store` | Save text to memory |
| `memory_forget` | Delete a memory entity |
| `memory_profile` | Get cognitive profile |
| `memory_procedures` | List learned workflows |
| `memory_feedback` | Record workflow success/failure (triggers evolution) |

## Slash Commands

| Command | Action |
|---|---|
| `/remember <text>` | Save to memory |
| `/recall <query>` | Search memory |
| `/forget <entity>` | Delete from memory |

## CLI

```bash
openclaw mengram search "coffee preferences"
openclaw mengram stats
openclaw mengram profile
openclaw mengram procedures
```

## Experience-Driven Procedures

Workflows learn from experience:

```
Day 1: Agent figures out deploy steps manually
Day 2: Agent finds the saved workflow, follows it (v1)
Day 3: Deploy fails — agent reports failure with context
Day 4: Procedure auto-evolved to v2 with fixed steps
```

Record outcomes with `memory_feedback`. On failure with context, the procedure automatically evolves.

## vs mem0

| Feature | mem0 | Mengram |
|---|---|---|
| Memory types | 1 (flat facts) | 3 (semantic + episodic + procedural) |
| Knowledge graph | Optional | Built-in Graph RAG (2-hop) |
| Self-improving workflows | No | Yes (auto-evolution) |
| Cognitive profile | No | Yes |
| Price | $99/mo+ | Free (open-source) |

## Links

- [mengram.io](https://mengram.io) — Get API key
- [GitHub](https://github.com/alibaizhanov/mengram) — Source code
- [API Docs](https://mengram.io/docs) — Full API reference

## License

Apache-2.0

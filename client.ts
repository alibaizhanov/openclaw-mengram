export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SemanticResult {
  entity: string;
  type: string;
  score: number;
  facts: string[];
  relations: Array<{
    type: string;
    direction: string;
    target: string;
    description?: string;
  }>;
  knowledge: Array<{
    type: string;
    title: string;
    content: string;
    artifact?: string | null;
  }>;
}

export interface EpisodicResult {
  id: string;
  summary: string;
  context?: string | null;
  outcome?: string | null;
  participants: string[];
  emotional_valence?: string | null;
  importance: number;
  score: number;
  created_at: string;
}

export interface ProceduralResult {
  id: string;
  name: string;
  trigger_condition?: string | null;
  steps: Array<{ step?: number; action: string; detail?: string }>;
  entity_names: string[];
  success_count: number;
  fail_count: number;
  version: number;
  score: number;
  updated_at?: string | null;
}

export interface SearchAllResponse {
  semantic: SemanticResult[];
  episodic: EpisodicResult[];
  procedural: ProceduralResult[];
}

export interface ProfileResponse {
  user_id: string;
  system_prompt: string;
  facts_used: number;
  last_updated?: string | null;
  status: string;
  error?: string;
}

export interface StatsResponse {
  entities: number;
  facts: number;
  knowledge: number;
  relations: number;
  embeddings: number;
  by_type: Record<string, number>;
}

export interface TriggerResult {
  id: number;
  trigger_type: string;
  title: string;
  detail?: string;
  fire_at?: string;
  fired: boolean;
  fired_at?: string;
  created_at: string;
}

export interface TimelineEvent {
  entity: string;
  type: string;
  fact: string;
  created_at: string;
  event_date?: string;
}

export interface GraphResponse {
  nodes: Array<{ name: string; type: string; facts_count?: number }>;
  edges: Array<{ source: string; target: string; type: string }>;
}

export interface AgentRunResult {
  status: string;
  agents?: Record<string, unknown>;
  agent?: string;
  result?: unknown;
}

export class MengramError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "MengramError";
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

export class MengramClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(apiKey: string, baseUrl = "https://mengram.io", timeout = 15000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeout = timeout;
  }

  private buildUrl(path: string, params?: QueryParams): string {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const entries = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      if (entries.length > 0) url += `?${entries.join("&")}`;
    }
    return url;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: QueryParams,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(this.buildUrl(path, params), {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new MengramError(
          `HTTP ${res.status}: ${text.slice(0, 200)}`,
          res.status,
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof MengramError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new MengramError("Request timed out", 408);
      }
      throw new MengramError(`Network error: ${(err as Error).message}`, 0);
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Search ----

  async searchAll(
    query: string,
    limit = 5,
    graphDepth = 2,
  ): Promise<SearchAllResponse> {
    return this.request("POST", "/v1/search/all", {
      query,
      limit,
      graph_depth: graphDepth,
    });
  }

  // ---- Memory ----

  async add(
    messages: Message[],
  ): Promise<{ status: string; job_id?: string }> {
    return this.request("POST", "/v1/add", { messages });
  }

  async addText(text: string): Promise<{ status: string; job_id?: string }> {
    return this.request("POST", "/v1/add_text", { text });
  }

  async deleteMemory(name: string): Promise<{ status: string }> {
    return this.request(
      "DELETE",
      `/v1/entity/${encodeURIComponent(name)}`,
    );
  }

  async archiveFact(
    entityName: string,
    fact: string,
  ): Promise<{ archived: string; entity: string }> {
    return this.request("POST", "/v1/archive_fact", {
      entity_name: entityName,
      fact_content: fact,
    });
  }

  async getStats(): Promise<StatsResponse> {
    return this.request("GET", "/v1/stats");
  }

  // ---- Cognitive Profile ----

  async getProfile(
    userId?: string,
    force = false,
  ): Promise<ProfileResponse> {
    const params: QueryParams = {};
    if (force) params.force = true;
    const path = userId && userId !== "default"
      ? `/v1/profile/${encodeURIComponent(userId)}`
      : "/v1/profile";
    return this.request("GET", path, undefined, params);
  }

  // ---- Episodes ----

  async getEpisodes(
    limit = 20,
    after?: string,
    before?: string,
  ): Promise<{ episodes: EpisodicResult[]; count: number }> {
    return this.request("GET", "/v1/episodes", undefined, {
      limit,
      after,
      before,
    });
  }

  async searchEpisodes(
    query: string,
    limit = 5,
    after?: string,
    before?: string,
  ): Promise<{ results: EpisodicResult[] }> {
    return this.request("GET", "/v1/episodes/search", undefined, {
      query,
      limit,
      after,
      before,
    });
  }

  // ---- Procedures ----

  async getProcedures(
    query?: string,
    limit = 20,
  ): Promise<{ procedures?: ProceduralResult[]; results?: ProceduralResult[] }> {
    if (query) {
      return this.request("GET", "/v1/procedures/search", undefined, {
        query,
        limit,
      });
    }
    return this.request("GET", "/v1/procedures", undefined, { limit });
  }

  async procedureFeedback(
    id: string,
    success: boolean,
    context?: string,
    failedAtStep?: number,
  ): Promise<{
    id: string;
    name: string;
    success_count: number;
    fail_count: number;
    feedback: string;
    evolution_triggered: boolean;
  }> {
    return this.request(
      "PATCH",
      `/v1/procedures/${id}/feedback`,
      context ? { context, failed_at_step: failedAtStep } : undefined,
      { success },
    );
  }

  async procedureHistory(
    id: string,
  ): Promise<{ versions: ProceduralResult[]; evolution_log: unknown[] }> {
    return this.request("GET", `/v1/procedures/${id}/history`);
  }

  async procedureEvolution(
    id: string,
  ): Promise<{ evolution: unknown[] }> {
    return this.request("GET", `/v1/procedures/${id}/evolution`);
  }

  // ---- Agents ----

  async runAgents(
    agent = "all",
    autoFix = false,
  ): Promise<AgentRunResult> {
    return this.request("POST", "/v1/agents/run", undefined, {
      agent,
      auto_fix: autoFix,
    });
  }

  async agentHistory(
    agent?: string,
    limit = 10,
  ): Promise<{ runs: unknown[]; total: number }> {
    return this.request("GET", "/v1/agents/history", undefined, {
      agent,
      limit,
    });
  }

  async agentStatus(): Promise<{ due: unknown; last_runs: unknown[] }> {
    return this.request("GET", "/v1/agents/status");
  }

  // ---- Insights ----

  async reflect(): Promise<{
    status: string;
    generated: { entity_reflections: number; cross_entity: number; temporal: number };
  }> {
    return this.request("POST", "/v1/reflect");
  }

  async getReflections(
    scope?: string,
  ): Promise<{ reflections: Array<{ scope: string; content: string; created_at: string }> }> {
    return this.request("GET", "/v1/reflections", undefined, { scope });
  }

  async getInsights(): Promise<unknown> {
    return this.request("GET", "/v1/insights");
  }

  // ---- Timeline / Graph / Feed ----

  async getTimeline(
    after?: string,
    before?: string,
    limit = 20,
  ): Promise<{ results: TimelineEvent[] }> {
    return this.request("GET", "/v1/timeline", undefined, {
      after,
      before,
      limit,
    });
  }

  async getGraph(): Promise<GraphResponse> {
    return this.request("GET", "/v1/graph");
  }

  async getFeed(
    limit = 50,
  ): Promise<{ feed: unknown[] }> {
    return this.request("GET", "/v1/feed", undefined, { limit });
  }

  // ---- Triggers ----

  async getTriggers(
    includeFired = false,
    limit = 50,
  ): Promise<{ triggers: TriggerResult[]; count: number }> {
    return this.request("GET", "/v1/triggers", undefined, {
      include_fired: includeFired,
      limit,
    });
  }

  async processTriggers(): Promise<unknown> {
    return this.request("POST", "/v1/triggers/process");
  }

  async dismissTrigger(
    triggerId: number,
  ): Promise<{ status: string; id: number }> {
    return this.request("DELETE", `/v1/triggers/${triggerId}`);
  }

  async detectTriggers(
    userId: string,
  ): Promise<unknown> {
    return this.request(
      "POST",
      `/v1/triggers/detect/${encodeURIComponent(userId)}`,
    );
  }

  // ---- Maintenance ----

  async reindex(): Promise<{ reindexed: number }> {
    return this.request("POST", "/v1/reindex");
  }

  async dedup(): Promise<{ merged: string[]; count: number }> {
    return this.request("POST", "/v1/dedup");
  }

  async dedupAll(): Promise<{ total_archived: number; entities: unknown[] }> {
    return this.request("POST", "/v1/dedup_all");
  }

  async merge(
    source: string,
    target: string,
  ): Promise<{ status: string; from: string; into: string }> {
    return this.request("POST", "/v1/merge", undefined, { source, target });
  }

  async mergeUser(): Promise<{ status: string; from?: string; into?: string }> {
    return this.request("POST", "/v1/merge_user");
  }

  // ---- Teams ----

  async createTeam(
    name: string,
    description = "",
  ): Promise<{ status: string; team: unknown }> {
    return this.request("POST", "/v1/teams", { name, description });
  }

  async listTeams(): Promise<{ teams: unknown[]; total: number }> {
    return this.request("GET", "/v1/teams");
  }

  async joinTeam(
    inviteCode: string,
  ): Promise<unknown> {
    return this.request("POST", "/v1/teams/join", { invite_code: inviteCode });
  }

  async teamMembers(
    teamId: number,
  ): Promise<{ members: unknown[]; total: number }> {
    return this.request("GET", `/v1/teams/${teamId}/members`);
  }

  async shareEntity(
    teamId: number,
    entity: string,
  ): Promise<unknown> {
    return this.request("POST", `/v1/teams/${teamId}/share`, { entity });
  }

  async unshareEntity(
    teamId: number,
    entity: string,
  ): Promise<unknown> {
    return this.request("POST", `/v1/teams/${teamId}/unshare`, { entity });
  }

  async leaveTeam(
    teamId: number,
  ): Promise<{ status: string }> {
    return this.request("POST", `/v1/teams/${teamId}/leave`);
  }

  async deleteTeam(
    teamId: number,
  ): Promise<{ status: string }> {
    return this.request("DELETE", `/v1/teams/${teamId}`);
  }

  // ---- Webhooks ----

  async createWebhook(
    url: string,
    eventTypes: string[],
    name = "",
    secret = "",
  ): Promise<{ status: string; webhook: unknown }> {
    return this.request("POST", "/v1/webhooks", {
      url,
      event_types: eventTypes,
      name,
      secret,
    });
  }

  async listWebhooks(): Promise<{ webhooks: unknown[]; total: number }> {
    return this.request("GET", "/v1/webhooks");
  }

  async updateWebhook(
    id: number,
    updates: { url?: string; name?: string; eventTypes?: string[]; active?: boolean },
  ): Promise<unknown> {
    const body: Record<string, unknown> = {};
    if (updates.url !== undefined) body.url = updates.url;
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.eventTypes !== undefined) body.event_types = updates.eventTypes;
    if (updates.active !== undefined) body.active = updates.active;
    return this.request("PUT", `/v1/webhooks/${id}`, body);
  }

  async deleteWebhook(
    id: number,
  ): Promise<{ status: string; id: number }> {
    return this.request("DELETE", `/v1/webhooks/${id}`);
  }

  // ---- API Keys ----

  async listKeys(): Promise<{ keys: unknown[]; total: number }> {
    return this.request("GET", "/v1/keys");
  }

  async createKey(
    name = "default",
  ): Promise<{ key: string; name: string; message: string }> {
    return this.request("POST", "/v1/keys", { name });
  }

  async revokeKey(
    keyId: string,
  ): Promise<{ status: string; key_id: string }> {
    return this.request("DELETE", `/v1/keys/${encodeURIComponent(keyId)}`);
  }

  async renameKey(
    keyId: string,
    name: string,
  ): Promise<{ status: string; key_id: string; name: string }> {
    return this.request("PATCH", `/v1/keys/${encodeURIComponent(keyId)}`, { name });
  }

  // ---- Jobs ----

  async jobStatus(
    jobId: string,
  ): Promise<{ status: string; result?: unknown }> {
    return this.request("GET", `/v1/jobs/${encodeURIComponent(jobId)}`);
  }

  // ---- Health ----

  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request("GET", "/v1/health");
  }
}

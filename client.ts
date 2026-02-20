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

export class MengramError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "MengramError";
  }
}

export class MengramClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(apiKey: string, baseUrl = "https://mengram.io", timeout = 15000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeout = timeout;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
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

  async search(
    query: string,
    limit = 5,
    graphDepth = 2,
  ): Promise<{ results: SemanticResult[] }> {
    return this.request("POST", "/v1/search", {
      query,
      limit,
      graph_depth: graphDepth,
    });
  }

  async add(
    messages: Message[],
  ): Promise<{ status: string; job_id?: string }> {
    return this.request("POST", "/v1/add", { messages });
  }

  async addText(text: string): Promise<{ status: string }> {
    return this.request("POST", "/v1/add_text", { text });
  }

  async getProfile(
    userId = "default",
    force = false,
  ): Promise<ProfileResponse> {
    const qs = force ? "?force=true" : "";
    return this.request("GET", `/v1/profile/${userId}${qs}`);
  }

  async getMemories(): Promise<{ memories: unknown[] }> {
    return this.request("GET", "/v1/memories");
  }

  async getMemory(name: string): Promise<unknown> {
    return this.request(
      "GET",
      `/v1/memory/${encodeURIComponent(name)}`,
    );
  }

  async deleteMemory(name: string): Promise<{ status: string }> {
    return this.request(
      "DELETE",
      `/v1/entity/${encodeURIComponent(name)}`,
    );
  }

  async getProcedures(
    query?: string,
    limit = 20,
  ): Promise<{ procedures?: ProceduralResult[]; results?: ProceduralResult[] }> {
    if (query) {
      return this.request(
        "GET",
        `/v1/procedures/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      );
    }
    return this.request("GET", `/v1/procedures?limit=${limit}`);
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
      `/v1/procedures/${id}/feedback?success=${success}`,
      context ? { context, failed_at_step: failedAtStep } : undefined,
    );
  }

  async getStats(): Promise<StatsResponse> {
    return this.request("GET", "/v1/stats");
  }
}

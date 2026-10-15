import type { Artifact, Memory, Message, ModelInfo, Prompt, Settings, Skill, Thread } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getSettings: () => req<Settings>("/api/settings"),
  saveSettings: (data: Partial<Settings>) =>
    req<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(data) }),

  getModels: () => req<{ data: ModelInfo[] }>("/api/models").then((r) => r.data),
  getSkills: () => req<Skill[]>("/api/skills"),

  getThreads: () => req<Thread[]>("/api/threads"),
  createThread: (data: Partial<Thread> = {}) =>
    req<Thread>("/api/threads", { method: "POST", body: JSON.stringify(data) }),
  updateThread: (id: string, data: Partial<Thread>) =>
    req<Thread>(`/api/threads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteThread: (id: string) => req<{ ok: boolean }>(`/api/threads/${id}`, { method: "DELETE" }),
  getMessages: (id: string) => req<Message[]>(`/api/threads/${id}/messages`),
  clearMessages: (id: string) => req<{ ok: boolean }>(`/api/threads/${id}/messages`, { method: "DELETE" }),
  deleteMessage: (id: string, messageId: string) =>
    req<{ ok: boolean }>(`/api/threads/${id}/messages/${messageId}`, { method: "DELETE" }),

  getArtifacts: (threadId: string) => req<Artifact[]>(`/api/threads/${threadId}/artifacts`),
  createArtifact: (threadId: string, data: Partial<Artifact>) =>
    req<Artifact>(`/api/threads/${threadId}/artifacts`, { method: "POST", body: JSON.stringify(data) }),
  updateArtifact: (id: string, data: Partial<Artifact>) =>
    req<Artifact>(`/api/artifacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteArtifact: (id: string) => req<{ ok: boolean }>(`/api/artifacts/${id}`, { method: "DELETE" }),
  exportUrl: (id: string, fmt: string) => `/api/artifacts/${id}/export?fmt=${fmt}`,

  getPrompts: () => req<Prompt[]>("/api/prompts"),
  createPrompt: (data: { title: string; content: string }) =>
    req<Prompt>("/api/prompts", { method: "POST", body: JSON.stringify(data) }),
  updatePrompt: (id: string, data: Partial<Prompt>) =>
    req<Prompt>(`/api/prompts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePrompt: (id: string) => req<{ ok: boolean }>(`/api/prompts/${id}`, { method: "DELETE" }),

  getMemories: () => req<Memory[]>("/api/memories"),
  createMemory: (data: { content: string; kind?: string; pinned?: boolean }) =>
    req<Memory>("/api/memories", { method: "POST", body: JSON.stringify(data) }),
  updateMemory: (id: string, data: Partial<Memory>) =>
    req<Memory>(`/api/memories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMemory: (id: string) => req<{ ok: boolean }>(`/api/memories/${id}`, { method: "DELETE" }),
  clearMemories: () => req<{ ok: boolean }>("/api/memories", { method: "DELETE" }),
};

export interface StreamHandlers {
  onMeta?: (d: any) => void;
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onVoting?: (d: any) => void;
  onDictatorship?: (d: any) => void;
  onRouting?: (d: any) => void;
  onFinal?: (d: any) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

export async function streamChat(
  threadId: string,
  body: { content: string; model?: string; regenerate_message_id?: string; voting_models?: string[] },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/threads/${threadId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* ignore */
    }
    handlers.onError?.(detail);
    handlers.onDone?.();
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      let event = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed: any = {};
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      switch (event) {
        case "meta":
          handlers.onMeta?.(parsed);
          break;
        case "delta":
          handlers.onDelta?.(parsed.text);
          break;
        case "reasoning":
          handlers.onReasoning?.(parsed.text);
          break;
        case "voting":
          handlers.onVoting?.(parsed);
          break;
        case "dictatorship":
          handlers.onDictatorship?.(parsed);
          break;
        case "routing":
          handlers.onRouting?.(parsed);
          break;
        case "final":
          handlers.onFinal?.(parsed);
          break;
        case "error":
          handlers.onError?.(parsed.message);
          break;
        case "done":
          handlers.onDone?.();
          break;
      }
    }
  }
}

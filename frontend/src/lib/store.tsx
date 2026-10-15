import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, streamChat } from "./api";
import { speak } from "./tts";
import type { Artifact, Memory, Message, ModelInfo, Prompt, Settings, Skill, Thread } from "./types";

interface ChatState {
  ready: boolean;
  settings: Settings | null;
  skills: Skill[];
  models: ModelInfo[];
  prompts: Prompt[];
  memories: Memory[];
  threads: Thread[];
  activeId: string | null;
  activeThread: Thread | null;
  messages: Message[];
  artifacts: Artifact[];
  streaming: boolean;
  canvasOpen: boolean;
  currentModel: string;
  notice: string | null;
  modelsError: string | null;

  selectThread: (id: string) => Promise<void>;
  newThread: () => Promise<void>;
  patchThread: (id: string, data: Partial<Thread>) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  send: (content: string) => Promise<void>;
  regenerate: (messageId: string) => Promise<void>;
  stop: () => void;
  deleteMessage: (messageId: string) => Promise<void>;
  clearMessages: () => Promise<void>;
  setModel: (id: string) => Promise<void>;
  toggleSkill: (name: string) => Promise<void>;
  setCanvasOpen: (open: boolean) => void;
  saveSettings: (data: Partial<Settings>) => Promise<void>;
  refreshPrompts: () => Promise<void>;
  refreshMemories: () => Promise<void>;
  addMemory: (content: string, kind?: string, pinned?: boolean) => Promise<void>;
  updateMemory: (id: string, data: Partial<Memory>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearMemories: () => Promise<void>;
  upsertArtifact: (artifact: Artifact) => void;
  removeArtifact: (id: string) => void;
  addArtifact: (threadId: string, data: Partial<Artifact>) => Promise<Artifact>;
  updateArtifact: (id: string, data: Partial<Artifact>) => Promise<void>;
  setNotice: (msg: string | null) => void;
  reloadModels: () => Promise<void>;
}

const Ctx = createContext<ChatState | null>(null);

export function useChat(): ChatState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId],
  );

  const currentModel = activeThread?.model || settings?.default_model || "";

  const reloadModels = useCallback(async () => {
    try {
      setModels(await api.getModels());
      setModelsError(null);
    } catch (e: any) {
      setModelsError(e?.message || "Failed to load models");
    }
  }, []);

  const refreshPrompts = useCallback(async () => {
    try {
      setPrompts(await api.getPrompts());
    } catch {
      /* ignore */
    }
  }, []);

  const refreshMemories = useCallback(async () => {
    try {
      setMemories(await api.getMemories());
    } catch {
      /* ignore */
    }
  }, []);

  const addMemory = useCallback(
    async (content: string, kind = "fact", pinned = false) => {
      const m = await api.createMemory({ content, kind, pinned });
      setMemories((prev) => [m, ...prev]);
    },
    [],
  );

  const updateMemory = useCallback(async (id: string, data: Partial<Memory>) => {
    const m = await api.updateMemory(id, data);
    setMemories((prev) => prev.map((x) => (x.id === id ? m : x)));
  }, []);

  const deleteMemory = useCallback(async (id: string) => {
    await api.deleteMemory(id);
    setMemories((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clearMemories = useCallback(async () => {
    await api.clearMemories();
    setMemories([]);
  }, []);

  const loadThreadContent = useCallback(async (id: string) => {
    const [msgs, arts] = await Promise.all([api.getMessages(id), api.getArtifacts(id)]);
    if (activeIdRef.current !== id) return;
    setMessages(msgs);
    setArtifacts(arts);
  }, []);

  useEffect(() => {
    (async () => {
      const [s, sk, th] = await Promise.all([api.getSettings(), api.getSkills(), api.getThreads()]);
      setSettings(s);
      setSkills(sk);
      setThreads(th);
      await refreshPrompts();
      await refreshMemories();
      if (th.length) {
        setActiveId(th[0].id);
        await loadThreadContent(th[0].id);
      }
      setReady(true);
      reloadModels();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectThread = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setStreaming(false);
      setActiveId(id);
      activeIdRef.current = id;
      setMessages([]);
      setArtifacts([]);
      await loadThreadContent(id);
    },
    [loadThreadContent],
  );

  const newThread = useCallback(async () => {
    const thread = await api.createThread({
      model: settings?.default_model || "",
      title: "New thread",
    });
    setThreads((prev) => [thread, ...prev]);
    await selectThread(thread.id);
  }, [settings, selectThread]);

  const patchThread = useCallback(async (id: string, data: Partial<Thread>) => {
    const updated = await api.updateThread(id, data);
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  }, []);

  const deleteThread = useCallback(
    async (id: string) => {
      await api.deleteThread(id);
      const rest = threads.filter((t) => t.id !== id);
      setThreads(rest);
      if (activeId === id) {
        if (rest.length) await selectThread(rest[0].id);
        else {
          setActiveId(null);
          setMessages([]);
          setArtifacts([]);
        }
      }
    },
    [threads, activeId, selectThread],
  );

  const setModel = useCallback(
    async (id: string) => {
      if (!activeId) return;
      setThreads((prev) => prev.map((t) => (t.id === activeId ? { ...t, model: id } : t)));
      await patchThread(activeId, { model: id });
    },
    [activeId, patchThread],
  );

  const toggleSkill = useCallback(
    async (name: string) => {
      if (!activeThread) return;
      const enabled = new Set(activeThread.enabled_skills || []);
      if (enabled.has(name)) enabled.delete(name);
      else enabled.add(name);
      const list = Array.from(enabled);
      await patchThread(activeThread.id, { enabled_skills: list });
    },
    [activeThread, patchThread],
  );

  const refreshActive = useCallback(
    async (id: string) => {
      const [msgs, arts, th] = await Promise.all([
        api.getMessages(id),
        api.getArtifacts(id),
        api.getThreads(),
      ]);
      if (activeIdRef.current !== id) return;
      setMessages(msgs);
      setArtifacts(arts);
      setThreads(th);
    },
    [],
  );

  const runStream = useCallback(
    async (
      threadId: string,
      body: { content: string; model?: string; regenerate_message_id?: string; voting_models?: string[] },
      optimistic?: { user?: Message; assistant?: Message },
    ) => {
      if (optimistic?.user || optimistic?.assistant) {
        const extra: Message[] = [];
        if (optimistic.user) extra.push(optimistic.user);
        if (optimistic.assistant) extra.push(optimistic.assistant);
        setMessages((prev) => [...prev, ...extra]);
      }
      setStreaming(true);
      setNotice(null);
      const assistantId = optimistic?.assistant?.id;
      const controller = new AbortController();
      abortRef.current = controller;
      let acc = "";
      let reasoning = "";
      let voting: any = null;
      let dictatorship: any = null;
      let routing: any = null;

      const patchAssistant = (fn: (m: Message) => Message) => {
        if (!assistantId) return;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
      };

      const onVoting = (ev: any) => {
        if (ev?.type === "voting_result") {
          voting = ev;
          patchAssistant((m) => ({
            ...m,
            content: m.content || ev.answer || "",
            meta: { ...m.meta, mode: "voting", voting: ev },
          }));
          return;
        }
        if (!voting || typeof voting !== "object") {
          voting = { candidates: [], rounds: [], votes: [] };
        }
        if (ev?.type === "voting_start") {
          voting = { ...voting, ...ev, candidates: [], rounds: [], votes: [] };
        } else if (ev?.type === "voting_candidate") {
          voting.candidates = [...(voting.candidates || []), ev];
        } else if (ev?.type === "voting_round") {
          voting.rounds = [...(voting.rounds || []), ev];
        } else if (ev?.type === "voting_vote") {
          voting.votes = [...(voting.votes || []), ev];
        } else if (ev?.type === "voting_tally") {
          voting = { ...voting, tally: ev.tally, total: ev.total };
        }
        patchAssistant((m) => ({ ...m, meta: { ...m.meta, mode: "voting", voting } }));
      };

      const onDictatorship = (ev: any) => {
        if (ev?.type === "dictatorship_result") {
          dictatorship = ev;
          patchAssistant((m) => ({
            ...m,
            content: m.content || ev.answer || "",
            meta: { ...m.meta, mode: "dictatorship", dictatorship: ev },
          }));
          return;
        }
        if (!dictatorship || typeof dictatorship !== "object") {
          dictatorship = { generators: [], candidates: [], comparisons: [] };
        }
        if (ev?.type === "dictatorship_start") {
          dictatorship = { ...dictatorship, ...ev, candidates: [], comparisons: [] };
        } else if (ev?.type === "dictatorship_generator") {
          dictatorship.candidates = [...(dictatorship.candidates || []), ev];
        } else if (ev?.type === "dictatorship_compare") {
          dictatorship.comparisons = [...(dictatorship.comparisons || []), ev];
        }
        patchAssistant((m) => ({ ...m, meta: { ...m.meta, mode: "dictatorship", dictatorship } }));
      };

      const onRouting = (ev: any) => {
        routing = ev;
        patchAssistant((m) => ({
          ...m,
          model: ev.model || m.model,
          meta: { ...m.meta, mode: "routing", routing: ev },
        }));
      };

      try {
        await streamChat(
          threadId,
          body,
          {
            onDelta: (t) => {
              acc += t;
              patchAssistant((m) => ({ ...m, content: m.content + t }));
            },
            onReasoning: (t) => {
              reasoning += t;
              patchAssistant((m) => ({ ...m, meta: { ...m.meta, reasoning } }));
            },
            onVoting,
            onDictatorship,
            onRouting,
            onError: (msg) => {
              setNotice(msg);
              patchAssistant((m) => ({ ...m, meta: { ...m.meta, error: msg } }));
            },
            onFinal: (d) => {
              patchAssistant((m) => ({
                ...m,
                content: d.content,
                meta: {
                  ...m.meta,
                  canvas: d.artifacts,
                  tokens_saved: d.tokens_saved,
                  ...(d.mode ? { mode: d.mode } : {}),
                  ...(d.voting ? { voting: d.voting } : {}),
                  ...(d.dictatorship ? { dictatorship: d.dictatorship } : {}),
                  ...(d.routing ? { routing: d.routing } : {}),
                },
              }));
            },
          },
          controller.signal,
        );
      } catch (e: any) {
        if (e?.name !== "AbortError") setNotice(String(e?.message || e));
      } finally {
        setStreaming(false);
        abortRef.current = null;
        await refreshActive(threadId);
        if (settings?.auto_tts && acc.trim()) {
          speak(
            acc,
            { voice: settings.tts_voice, rate: settings.tts_rate },
            (msg) => setNotice(msg),
          );
        }
      }
    },
    [refreshActive, settings],
  );

  const send = useCallback(
    async (content: string) => {
      if (!activeId || !content.trim() || streaming) return;
      const now = new Date().toISOString();
      const user: Message = {
        id: `local-user-${Date.now()}`,
        thread_id: activeId,
        role: "user",
        content,
        model: null,
        prompt_tokens: null,
        completion_tokens: null,
        meta: {},
        created_at: now,
      };
      const assistant: Message = {
        id: `local-assistant-${Date.now()}`,
        thread_id: activeId,
        role: "assistant",
        content: "",
        model: currentModel,
        prompt_tokens: null,
        completion_tokens: null,
        meta: {},
        created_at: now,
        streaming: true,
      };
      await runStream(activeId, { content, model: currentModel }, { user, assistant });
    },
    [activeId, currentModel, streaming, runStream],
  );

  const regenerate = useCallback(
    async (messageId: string) => {
      if (!activeId || streaming) return;
      const idx = messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;
      setMessages((prev) => prev.slice(0, idx));
      const assistant: Message = {
        id: `local-assistant-${Date.now()}`,
        thread_id: activeId,
        role: "assistant",
        content: "",
        model: currentModel,
        prompt_tokens: null,
        completion_tokens: null,
        meta: {},
        created_at: new Date().toISOString(),
        streaming: true,
      };
      await runStream(activeId, { content: "", model: currentModel, regenerate_message_id: messageId }, { assistant });
    },
    [activeId, currentModel, messages, streaming, runStream],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeId) return;
      await api.deleteMessage(activeId, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [activeId],
  );

  const clearMessages = useCallback(async () => {
    if (!activeId) return;
    await api.clearMessages(activeId);
    setMessages([]);
    setArtifacts([]);
  }, [activeId]);

  const saveSettings = useCallback(async (data: Partial<Settings>) => {
    const s = await api.saveSettings(data);
    setSettings(s);
  }, []);

  const upsertArtifact = useCallback((artifact: Artifact) => {
    setArtifacts((prev) => {
      const exists = prev.some((a) => a.id === artifact.id);
      return exists ? prev.map((a) => (a.id === artifact.id ? artifact : a)) : [...prev, artifact];
    });
  }, []);

  const removeArtifact = useCallback((id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addArtifact = useCallback(
    async (threadId: string, data: Partial<Artifact>) => {
      const a = await api.createArtifact(threadId, data);
      upsertArtifact(a);
      return a;
    },
    [upsertArtifact],
  );

  const updateArtifact = useCallback(
    async (id: string, data: Partial<Artifact>) => {
      const a = await api.updateArtifact(id, data);
      upsertArtifact(a);
    },
    [upsertArtifact],
  );

  const value: ChatState = {
    ready,
    settings,
    skills,
    models,
    prompts,
    memories,
    threads,
    activeId,
    activeThread,
    messages,
    artifacts,
    streaming,
    canvasOpen,
    currentModel,
    notice,
    modelsError,
    selectThread,
    newThread,
    patchThread,
    deleteThread,
    send,
    regenerate,
    stop,
    deleteMessage,
    clearMessages,
    setModel,
    toggleSkill,
    setCanvasOpen,
    saveSettings,
    refreshPrompts,
    refreshMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    clearMemories,
    upsertArtifact,
    removeArtifact,
    addArtifact,
    updateArtifact,
    setNotice,
    reloadModels,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

import { useEffect, useMemo, useRef } from "react";
import { useChat } from "../lib/store";
import Composer from "./Composer";
import Icon from "./Icon";
import Message from "./Message";
import ModelPicker from "./ModelPicker";
import SkillsMenu from "./SkillsMenu";

const SUGGESTIONS = [
  "Summarize this article into a one-page brief",
  "Write a Python script that renames files by date",
  "Draft a polite follow-up email to a client",
  "Explain how transformers work, simply",
];

export default function ChatWindow({
  onOpenArtifact,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  onOpenArtifact: (id: string) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const {
    messages,
    activeThread,
    activeId,
    streaming,
    canvasOpen,
    setCanvasOpen,
    toggleSkill,
    send,
    settings,
    saveSettings,
    artifacts,
  } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const enabledSkills = activeThread?.enabled_skills || [];
  const canvasOn = enabledSkills.includes("canvas");

  const ordered = useMemo(() => messages, [messages]);

  const context = useMemo(() => {
    const chars = ordered.reduce((n, m) => n + (m.content?.length || 0), 0);
    return { count: ordered.length, tokens: Math.round(chars / 4) };
  }, [ordered]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [ordered]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };

  const toggleCanvas = async () => {
    if (!activeThread) return;
    setCanvasOpen(!canvasOn);
    await toggleSkill("canvas");
  };

  const toggleAutoTts = () => {
    if (!settings) return;
    saveSettings({ auto_tts: !settings.auto_tts });
  };

  return (
    <div className="chat">
      <div className="chat-head">
        <button className="btn ghost icon" onClick={onToggleSidebar} title="Toggle sidebar">
          <Icon name="menu" size={16} />
        </button>

        <button
          className={`switch ${canvasOn ? "on" : ""}`}
          onClick={toggleCanvas}
          title="Toggle Canvas mode (skill + panel)"
        >
          <span className="track">
            <span className="knob" />
          </span>
          Canvas
        </button>
        <button
          className="btn ghost icon"
          onClick={() => setCanvasOpen(!canvasOpen)}
          title={canvasOpen ? "Hide canvas panel" : "Show canvas panel"}
        >
          <Icon name="panel" size={16} />
        </button>
        {artifacts.length > 0 && (
          <button className="badge" onClick={() => setCanvasOpen(true)} title="Artifacts">
            {artifacts.length} artifact{artifacts.length > 1 ? "s" : ""}
          </button>
        )}

        <SkillsMenu />

        {enabledSkills.length > 0 && (
          <div className="active-skills" title="Active skills">
            {enabledSkills.map((s) => (
              <button
                key={s}
                className="skill-tag"
                onClick={() => toggleSkill(s)}
                title={`Turn off ${s}`}
              >
                <Icon name="sparkles" size={11} />
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="spacer" />

        {activeId && context.count > 0 && (
          <span className="badge" title="Messages in context · estimated tokens">
            {context.count} msg · ~{context.tokens >= 1000 ? `${(context.tokens / 1000).toFixed(1)}k` : context.tokens} tk
          </span>
        )}

        <button
          className={`btn ${settings?.auto_tts ? "primary" : ""}`}
          onClick={toggleAutoTts}
          title="Auto-read replies aloud"
        >
          <Icon name="volume" size={14} />
          Read aloud
        </button>

        <ModelPicker />
      </div>

      <div className="messages" ref={scrollRef} onScroll={onScroll}>
        {!activeId ? (
          <div className="empty">
            <div className="logo">chati</div>
            <h2>Start a thread</h2>
            <div>Chat with any OpenRouter model. Switch models without losing context.</div>
            <div className="suggestions">
              <span className="hint">Create a new thread from the sidebar to begin.</span>
            </div>
          </div>
        ) : ordered.length === 0 ? (
          <div className="empty">
            <div className="logo">chati</div>
            <h2>What can I help with?</h2>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
            {!settings?.has_api_key && (
              <div style={{ color: "var(--yellow)", fontSize: 13 }}>
                Add your OpenRouter API key in Settings first.
              </div>
            )}
          </div>
        ) : (
          <>
            {ordered.map((m) => (
              <Message key={m.id} message={m} onOpenArtifact={onOpenArtifact} />
            ))}
            <div style={{ height: 8 }} />
          </>
        )}
      </div>

      {activeId && <Composer />}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useChat } from "../lib/store";
import { useOutsideClick } from "../lib/useOutsideClick";
import { speak, stopSpeaking, isSpeaking } from "../lib/tts";
import Icon from "./Icon";

interface EftSub {
  id: string;
  name: string;
  desc: string;
}

interface EftMode {
  id: string;
  name: string;
  desc: string;
  ready: boolean;
  submodes?: EftSub[];
}

const EFT_MODES: EftMode[] = [
  {
    id: "voting",
    name: "Voting",
    desc: "Several models answer, then vote among themselves. Self-bias and position-bias corrected.",
    ready: true,
  },
  {
    id: "routing",
    name: "Routing",
    desc: "Send each prompt to the best-fit model — via an LLM router or a system-1 decision router.",
    ready: true,
    submodes: [
      { id: "llm", name: "1 · LLM router", desc: "Qwen classifier picks the lane" },
      { id: "decision", name: "2 · system-1 decision", desc: "tev1:4b scores lanes via logprobs" },
    ],
  },
  {
    id: "dictatorship",
    name: "Dictatorship",
    desc: "3 generators answer, one stronger judge picks the best via swap-controlled comparisons.",
    ready: true,
  },
];

export default function Composer() {
  const { send, stop, streaming, settings, saveSettings, activeId, prompts, activeThread, messages, patchThread } = useChat();
  const [text, setText] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useOutsideClick<HTMLDivElement>(() => setShowPrompts(false));
  const modeRef = useOutsideClick<HTMLDivElement>(() => setShowModes(false));

  const enabledSkills = activeThread?.enabled_skills || [];
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant" && m.content);
  const speaking = isSpeaking();

  const eftMode = activeThread?.mode || "normal";
  const eftOn = eftMode !== "normal";
  const routingSub = settings?.routing_submode || "llm";
  const setMode = (id: string, ready: boolean) => {
    if (!activeThread || !ready) return;
    patchThread(activeThread.id, { mode: id === "normal" ? "normal" : id });
    setShowModes(false);
  };
  const setRoutingSub = (id: string) => {
    saveSettings({ routing_submode: id });
    if (activeThread && activeThread.mode !== "routing") {
      patchThread(activeThread.id, { mode: "routing" });
    }
  };
  const eftLabel = !eftOn
    ? "off"
    : eftMode === "routing"
      ? `Routing · ${routingSub === "decision" ? "system-1" : "LLM"}`
      : EFT_MODES.find((m) => m.id === eftMode)?.name || eftMode;

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
  }, [text]);

  const canSend = text.trim().length > 0 && !streaming && !!activeId;

  const submit = () => {
    if (!canSend) return;
    const value = text;
    setText("");
    send(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer">
      <div className="composer-inner">
        <textarea
          ref={taRef}
          rows={1}
          placeholder={settings?.has_api_key ? "Message…  (Enter to send, Shift+Enter for newline)" : "Add your OpenRouter API key in Settings to start chatting"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="composer-tools">
          <div className="popover" ref={modeRef}>
            <button
              className={`btn ${eftOn ? "primary" : "ghost"}`}
              onClick={() => setShowModes((s) => !s)}
              title="EFT mode — ensemble decision strategy"
            >
              <Icon name="sparkles" size={15} />
              EFT: {eftLabel}
            </button>
            {showModes && (
              <div className="dropdown left eft-dropdown" style={{ bottom: "calc(100% + 6px)", top: "auto", width: 320 }}>
                <div className="dropdown-list" style={{ padding: 6 }}>
                  <div className="eft-head">EFT mode</div>
                  {EFT_MODES.map((m) => {
                    const active = eftMode === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`dd-item eft-item ${active ? "active" : ""} ${m.ready ? "" : "disabled"}`}
                        onClick={() => setMode(m.id, m.ready)}
                        title={m.ready ? m.desc : "Coming soon"}
                      >
                        <div className="eft-item-top">
                          <span className="dd-name">{m.name}</span>
                          {!m.ready && <span className="badge">soon</span>}
                          {active && m.ready && <span className="badge green">on</span>}
                        </div>
                        <div className="dd-sub">{m.desc}</div>
                        {m.submodes && (
                          <div className="eft-subs">
                            {m.submodes.map((s) => {
                              const subOn = eftMode === m.id && routingSub === s.id;
                              return (
                                <span
                                  key={s.id}
                                  className={`eft-sub eft-sub-btn ${subOn ? "on" : ""}`}
                                  title={s.desc}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRoutingSub(s.id);
                                  }}
                                >
                                  {subOn ? "● " : "○ "}
                                  {s.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="eft-sep" />
                  <div
                    className={`dd-item eft-item ${!eftOn ? "active" : ""}`}
                    onClick={() => setMode("normal", true)}
                  >
                    <div className="dd-name">Off</div>
                    <div className="dd-sub">Standard single-model chat</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="popover" ref={promptRef}>
            <button className="btn ghost" onClick={() => setShowPrompts((s) => !s)} title="Prompt library">
              <Icon name="book" size={15} />
              Prompts
            </button>
            {showPrompts && (
              <div className="dropdown left" style={{ bottom: "calc(100% + 6px)", top: "auto", width: 340 }}>
                <div className="dropdown-list" style={{ padding: 6 }}>
                  {prompts.length === 0 && (
                    <div style={{ padding: 12, fontSize: 12.5, color: "var(--muted)" }}>
                      No saved prompts yet. Add some from the sidebar.
                    </div>
                  )}
                  {prompts.map((p) => (
                    <div
                      key={p.id}
                      className="dd-item"
                      onClick={() => {
                        setText((t) => (t ? `${t}\n${p.content}` : p.content));
                        setShowPrompts(false);
                        taRef.current?.focus();
                      }}
                    >
                      <div className="dd-name">{p.title}</div>
                      <div className="dd-sub">
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.content.slice(0, 80)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {enabledSkills.length > 0 && (
            <div className="active-skills" style={{ marginRight: 8 }}>
              {enabledSkills.map((s) => (
                <span key={s} className="skill-tag">
                  <Icon name="sparkles" size={11} />
                  {s}
                </span>
              ))}
            </div>
          )}

          {lastAssistant && (
            <button
              className={`btn ${speaking ? "primary" : ""}`}
              onClick={() => {
                if (speaking) stopSpeaking();
                else speak(lastAssistant.content, { voice: settings?.tts_voice, rate: settings?.tts_rate });
              }}
              title={speaking ? "Stop reading" : "Read last reply"}
            >
              <Icon name={speaking ? "volumeX" : "volume"} size={14} />
            </button>
          )}

          <div className="spacer" />
          <span className="hint">{text.length ? `${text.length} chars` : ""}</span>
          {streaming ? (
            <button className="btn" onClick={stop}>
              <Icon name="stop" size={14} />
              Stop
            </button>
          ) : (
            <button className="btn primary" onClick={submit} disabled={!canSend}>
              <Icon name="send" size={14} />
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

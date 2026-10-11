import { useEffect, useRef, useState } from "react";
import { useChat } from "../lib/store";
import { useOutsideClick } from "../lib/useOutsideClick";
import { speak, stopSpeaking, isSpeaking } from "../lib/tts";
import Icon from "./Icon";

export default function Composer() {
  const { send, stop, streaming, settings, activeId, prompts, activeThread, messages } = useChat();
  const [text, setText] = useState("");
  const [showPrompts, setShowPrompts] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useOutsideClick<HTMLDivElement>(() => setShowPrompts(false));

  const enabledSkills = activeThread?.enabled_skills || [];
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant" && m.content);
  const speaking = isSpeaking();

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

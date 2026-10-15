import { useEffect, useRef, useState } from "react";
import { useChat } from "../lib/store";
import { speak, stopSpeaking } from "../lib/tts";
import type { Message as Msg } from "../lib/types";
import Icon from "./Icon";
import Markdown from "./Markdown";
import VotingPanel from "./VotingPanel";
import DictatorshipPanel from "./DictatorshipPanel";
import RoutingPanel from "./RoutingPanel";

function fmtTokens(n?: number | null): string {
  if (!n) return "";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export default function Message({
  message,
  onOpenArtifact,
}: {
  message: Msg;
  onOpenArtifact: (id: string) => void;
}) {
  const { settings, regenerate, deleteMessage, streaming, setNotice } = useChat();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const isUser = message.role === "user";
  const err = message.meta?.error as string | undefined;
  const reasoning = message.meta?.reasoning as string | undefined;
  const canvas = (message.meta?.canvas as { id: string; title: string; kind: string }[] | undefined) || [];
  const saved = message.meta?.tokens_saved as number | undefined;
  const skillsUsed = (message.meta?.skills as string[] | undefined) || [];
  const memoriesUsed = (message.meta?.memories as number | undefined) || 0;
  const voting = message.meta?.voting;
  const interval = useRef<number | null>(null);

  useEffect(() => {
    if (!speaking) {
      if (interval.current) window.clearInterval(interval.current);
      return;
    }
    interval.current = window.setInterval(() => {
      if (typeof window !== "undefined" && !window.speechSynthesis.speaking) {
        setSpeaking(false);
      }
    }, 400);
    return () => {
      if (interval.current) window.clearInterval(interval.current);
    };
  }, [speaking]);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speak(
        message.content,
        { voice: settings?.tts_voice, rate: settings?.tts_rate },
        (msg) => setNotice(msg),
      );
      setSpeaking(true);
    }
  };

  return (
    <div className={`msg-wrap ${isUser ? "is-user" : "is-assistant"}`}>
      <div className={`avatar ${isUser ? "user" : "assistant"}`}>{isUser ? "U" : "AI"}</div>
      <div className="msg-body">
        <div className="msg-role">
          <span style={{ color: "var(--text-strong)", fontWeight: 600 }}>{isUser ? "You" : "Assistant"}</span>
          {!isUser && message.model && <span>{message.model}</span>}
          {!isUser && message.completion_tokens ? <span>{fmtTokens(message.completion_tokens)} tok</span> : null}
          {!isUser && memoriesUsed > 0 ? (
            <span className="badge purple" title="Long-term memories used in this reply">
              {memoriesUsed} memor{memoriesUsed > 1 ? "ies" : "y"}
            </span>
          ) : null}
          {saved ? <span className="badge green">saved ~{fmtTokens(saved)} tok</span> : null}
        </div>

        {!isUser && skillsUsed.length > 0 ? (
          <div className="skill-tags" title="Skills active for this reply">
            {skillsUsed.map((s) => (
              <span key={s} className="skill-tag">
                <Icon name="sparkles" size={11} />
                {s}
              </span>
            ))}
          </div>
        ) : null}

        {reasoning ? (
          <details className="reasoning">
            <summary>Reasoning</summary>
            <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{reasoning}</div>
          </details>
        ) : null}

        {message.content ? (
          <div className="msg-content">
            {isUser ? message.content : <Markdown>{message.content}</Markdown>}
            {message.streaming ? <span className="typing" /> : null}
          </div>
        ) : message.streaming ? (
          <div className="msg-content">
            <span className="typing" />
          </div>
        ) : null}

        {!isUser && voting ? <VotingPanel voting={voting} /> : null}
        {!isUser && message.meta?.dictatorship ? (
          <DictatorshipPanel data={message.meta.dictatorship} />
        ) : null}
        {!isUser && message.meta?.routing ? (
          <RoutingPanel data={message.meta.routing} />
        ) : null}

        {err ? (
          <div style={{ color: "var(--red)", fontSize: 13, marginTop: 6 }}>Error: {err}</div>
        ) : null}

        {canvas.length > 0 && (
          <div className="canvas-chips">
            {canvas.map((a) => (
              <span key={a.id} className="chip" onClick={() => onOpenArtifact(a.id)}>
                <Icon name={a.kind === "code" ? "code" : "file"} size={13} />
                {a.title}
              </span>
            ))}
          </div>
        )}

        {!message.streaming && message.content ? (
          <div className="msg-actions">
            <button className="btn ghost" onClick={copy} title="Copy">
              <Icon name={copied ? "check" : "copy"} size={13} />
              {copied ? "Copied" : "Copy"}
            </button>
            {!isUser && (
              <button className="btn ghost" onClick={toggleSpeak} title="Read aloud">
                <Icon name={speaking ? "volumeX" : "volume"} size={13} />
                {speaking ? "Stop" : "Read"}
              </button>
            )}
            {!isUser && (
              <button
                className="btn ghost"
                onClick={() => regenerate(message.id)}
                disabled={streaming}
                title="Regenerate"
              >
                <Icon name="refresh" size={13} />
                Retry
              </button>
            )}
            <button className="btn ghost danger" onClick={() => deleteMessage(message.id)} title="Delete">
              <Icon name="trash" size={13} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

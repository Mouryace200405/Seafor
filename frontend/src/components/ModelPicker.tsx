import { useMemo, useState } from "react";
import { useChat } from "../lib/store";
import { useOutsideClick } from "../lib/useOutsideClick";
import type { ModelInfo } from "../lib/types";
import Icon from "./Icon";

function priceLabel(m: ModelInfo): string {
  const p = parseFloat(m.prompt_price || "0");
  const c = parseFloat(m.completion_price || "0");
  if (p === 0 && c === 0) return "free";
  return `$${(p * 1e6).toFixed(2)}/M in`;
}

function ctxLabel(n: number): string {
  if (!n) return "—";
  if (n >= 1000) return `${Math.round(n / 1000)}k ctx`;
  return `${n} ctx`;
}

function providerLabel(m: ModelInfo): string {
  const p = (m.provider || "").toLowerCase();
  if (p === "openrouter") return "OpenRouter";
  if (p === "gemini") return "Gemini";
  if (p === "groq") return "Groq";
  if (p === "ollama") return "Ollama";
  return m.provider || "—";
}

function isFree(m: ModelInfo): boolean {
  const p = parseFloat(m.prompt_price || "0");
  const c = parseFloat(m.completion_price || "0");
  return p === 0 && c === 0;
}

export default function ModelPicker() {
  const { models, currentModel, setModel, modelsError, reloadModels } = useChat();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));

  const freeModels = useMemo(() => models.filter(isFree), [models]);
  const current = freeModels.find((m) => m.id === currentModel) || models.find((m) => m.id === currentModel);
  const label = current?.name || currentModel || "Select model";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? freeModels.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      : freeModels;
    return list.slice(0, 200);
  }, [freeModels, query]);

  return (
    <div className="popover" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)} title={currentModel}>
        <Icon name="zap" size={14} />
        <span style={{ maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <Icon name="chevron" size={13} />
      </button>
      {open && (
        <div className="dropdown" style={{ right: 0 }}>
          <div className="dropdown-search">
            <input
              autoFocus
              placeholder={`Search ${freeModels.length} free models…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="dropdown-list">
            {modelsError && (
              <div style={{ padding: 12, color: "var(--red)", fontSize: 12.5 }}>
                {modelsError}{" "}
                <button className="btn ghost" onClick={reloadModels}>
                  retry
                </button>
              </div>
            )}
            {filtered.map((m) => (
              <div
                key={m.id}
                className={`dd-item ${m.id === currentModel ? "active" : ""}`}
                onClick={() => {
                  setModel(m.id);
                  setOpen(false);
                }}
              >
                <div className="dd-name">{m.name}</div>
                <div className="dd-sub">
                  <span>{m.id}</span>
                  <span>{providerLabel(m)}</span>
                  <span>{ctxLabel(m.context_length)}</span>
                  <span>{priceLabel(m)}</span>
                </div>
              </div>
            ))}
            {!modelsError && filtered.length === 0 && (
              <div style={{ padding: 12, color: "var(--muted)", fontSize: 12.5 }}>No free models found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
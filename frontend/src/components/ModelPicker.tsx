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

export default function ModelPicker() {
  const { models, currentModel, setModel, modelsError, reloadModels } = useChat();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));

  const current = models.find((m) => m.id === currentModel);
  const label = current?.name || currentModel || "Select model";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      : models;
    return list.slice(0, 200);
  }, [models, query]);

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
              placeholder={`Search ${models.length} models…`}
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
                  <span>{ctxLabel(m.context_length)}</span>
                  <span>{priceLabel(m)}</span>
                </div>
              </div>
            ))}
            {!modelsError && filtered.length === 0 && (
              <div style={{ padding: 12, color: "var(--muted)", fontSize: 12.5 }}>No models found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

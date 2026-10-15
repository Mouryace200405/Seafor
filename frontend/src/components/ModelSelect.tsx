import { useMemo, useState } from "react";
import type { ModelInfo } from "../lib/types";

const PROVIDER_ORDER = ["groq", "ollama", "gemini", "openrouter"];

function providerLabel(p?: string): string {
  const v = (p || "").toLowerCase();
  return { groq: "Groq", ollama: "Ollama", gemini: "Gemini", openrouter: "OpenRouter" }[v] || p || "other";
}

function ctxLabel(n: number): string {
  if (!n) return "";
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k ctx` : `${n} ctx`;
}

export default function ModelSelect({
  models,
  onPick,
  trigger,
  title,
}: {
  models: ModelInfo[];
  onPick: (id: string) => void;
  trigger: React.ReactNode;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<string>("all");

  const providers = useMemo(() => {
    const set = new Set(models.map((m) => (m.provider || "other").toLowerCase()));
    const ordered = PROVIDER_ORDER.filter((p) => set.has(p));
    for (const p of set) if (!ordered.includes(p)) ordered.push(p);
    return ordered;
  }, [models]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      if (provider !== "all" && (m.provider || "").toLowerCase() !== provider) return false;
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        (m.name || "").toLowerCase().includes(q) ||
        (m.provider || "").toLowerCase().includes(q)
      );
    });
  }, [models, query, provider]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelInfo[]>();
    for (const m of filtered) {
      const key = providerLabel(m.provider);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [filtered]);

  const pick = (id: string) => {
    onPick(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="eft-mselect" title={title}>
      <div onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer" }}>
        {trigger}
      </div>
      {open && (
        <div className="eft-ms-panel">
          <div className="eft-ms-search">
            <input
              autoFocus
              placeholder={`Search ${models.length} models across all providers…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="eft-provider-filter">
            <button className={`eft-pf ${provider === "all" ? "active" : ""}`} onClick={() => setProvider("all")}>
              all
            </button>
            {providers.map((p) => (
              <button key={p} className={`eft-pf ${provider === p ? "active" : ""}`} onClick={() => setProvider(p)}>
                {providerLabel(p)}
              </button>
            ))}
          </div>
          <div className="eft-ms-list">
            {models.length === 0 && (
              <div className="eft-ms-empty">No models loaded.</div>
            )}
            {[...grouped.entries()].map(([group, items]) => (
              <div key={group}>
                <div className="eft-group-head">
                  {group} · {items.length}
                </div>
                {items.slice(0, 400).map((m) => (
                  <div key={m.id} className="dd-item" onClick={() => pick(m.id)}>
                    <div className="dd-name">
                      {m.name || m.id}
                      {m.provider ? <span className="eft-ms-provider">{providerLabel(m.provider)}</span> : null}
                    </div>
                    <div className="dd-sub">
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {m.id}
                      </span>
                      {ctxLabel(m.context_length) && <span>{ctxLabel(m.context_length)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {models.length > 0 && filtered.length === 0 && (
              <div className="eft-ms-empty">No matches.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

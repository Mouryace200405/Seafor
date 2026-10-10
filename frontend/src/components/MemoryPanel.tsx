import { useEffect, useMemo, useState } from "react";
import { useChat } from "../lib/store";
import type { Memory } from "../lib/types";
import Icon from "./Icon";

function ago(iso: string | null): string {
  if (!iso) return "never used";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "used today";
  if (days === 1) return "used yesterday";
  return `used ${days}d ago`;
}

export default function MemoryPanel({ onClose }: { onClose: () => void }) {
  const { memories, refreshMemories, addMemory, updateMemory, deleteMemory, clearMemories } = useChat();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    refreshMemories();
  }, [refreshMemories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? memories.filter((m) => m.content.toLowerCase().includes(q)) : memories;
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [memories, query]);

  const add = async () => {
    if (!draft.trim()) return;
    await addMemory(draft.trim());
    setDraft("");
  };

  const commitEdit = async (m: Memory) => {
    if (editText.trim() && editText.trim() !== m.content) {
      await updateMemory(m.id, { content: editText.trim() });
    }
    setEditing(null);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <Icon name="brain" size={16} />
          <h3 style={{ marginLeft: 8 }}>Memory</h3>
          <button className="btn ghost icon" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="hint">
            Durable facts the assistant learns about you, shared across every thread. Memories are
            recalled automatically by relevance — even in brand-new threads or after switching models.
          </div>

          <div className="field">
            <label>Add a memory</label>
            <div className="row">
              <input
                style={{ flex: 1 }}
                placeholder="e.g. My name is Ivan and I prefer concise answers"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
              />
              <button className="btn primary" onClick={add}>
                <Icon name="plus" size={14} />
                Add
              </button>
            </div>
          </div>

          {memories.length > 4 && (
            <input
              placeholder="Filter memories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}

          <div className="memory-list">
            {filtered.length === 0 && (
              <div className="hint" style={{ textAlign: "center", padding: "18px 0" }}>
                {memories.length === 0
                  ? "No memories yet. They build up automatically as you chat."
                  : "No matches."}
              </div>
            )}
            {filtered.map((m) => (
              <div key={m.id} className={`memory-item ${m.pinned ? "pinned" : ""}`}>
                <div className="memory-main">
                  {editing === m.id ? (
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => commitEdit(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(m);
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                  ) : (
                    <div className="memory-text">{m.content}</div>
                  )}
                  <div className="memory-meta">
                    <span className="badge">{m.kind}</span>
                    <span className="hint">{ago(m.last_used_at)}</span>
                    {m.use_count > 0 ? <span className="hint">· recalled {m.use_count}×</span> : null}
                  </div>
                </div>
                <div className="memory-actions">
                  <button
                    className="btn ghost icon"
                    title={m.pinned ? "Unpin" : "Pin"}
                    onClick={() => updateMemory(m.id, { pinned: !m.pinned })}
                    style={{ color: m.pinned ? "var(--accent)" : undefined }}
                  >
                    <Icon name="pin" size={13} />
                  </button>
                  <button
                    className="btn ghost icon"
                    title="Edit"
                    onClick={() => {
                      setEditing(m.id);
                      setEditText(m.content);
                    }}
                  >
                    <Icon name="edit" size={13} />
                  </button>
                  <button
                    className="btn ghost icon danger"
                    title="Forget"
                    onClick={() => deleteMemory(m.id)}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          {memories.length > 0 && (
            <button
              className="btn ghost danger"
              onClick={() => confirm("Forget all memories? This cannot be undone.") && clearMemories()}
            >
              Forget all
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { api } from "../lib/api";
import { useChat } from "../lib/store";
import Icon from "./Icon";

export default function PromptLibrary({ onClose }: { onClose: () => void }) {
  const { prompts, refreshPrompts } = useChat();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setContent("");
    setEditingId(null);
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    if (editingId) await api.updatePrompt(editingId, { title, content });
    else await api.createPrompt({ title: title.trim(), content });
    await refreshPrompts();
    reset();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>Prompt library</h3>
          <button className="btn ghost icon" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <input placeholder="Prompt title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea
              rows={3}
              placeholder="Prompt text…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              {editingId && (
                <button className="btn" onClick={reset}>
                  Cancel
                </button>
              )}
              <button className="btn primary" onClick={save} disabled={!title.trim() || !content.trim()}>
                {editingId ? "Update" : "Add prompt"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {prompts.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "var(--text-strong)", fontSize: 13 }}>{p.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "pre-wrap" }}>
                    {p.content.slice(0, 200)}
                  </div>
                </div>
                <button
                  className="btn ghost icon"
                  title="Edit"
                  onClick={() => {
                    setEditingId(p.id);
                    setTitle(p.title);
                    setContent(p.content);
                  }}
                >
                  <Icon name="edit" size={13} />
                </button>
                <button
                  className="btn ghost icon danger"
                  title="Delete"
                  onClick={async () => {
                    await api.deletePrompt(p.id);
                    await refreshPrompts();
                  }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
            {prompts.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 12.5, textAlign: "center", padding: 12 }}>
                No prompts saved yet.
              </div>
            )}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

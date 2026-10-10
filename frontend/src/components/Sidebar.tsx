import { useMemo, useState } from "react";
import { useChat } from "../lib/store";
import Icon from "./Icon";

export default function Sidebar({
  collapsed,
  onOpenSettings,
  onOpenPrompts,
  onOpenMemory,
}: {
  collapsed: boolean;
  onOpenSettings: () => void;
  onOpenPrompts: () => void;
  onOpenMemory: () => void;
}) {
  const { threads, activeId, selectThread, newThread, deleteThread, patchThread, memories } = useChat();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? threads.filter((t) => t.title.toLowerCase().includes(q) || t.preview.toLowerCase().includes(q))
      : threads;
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [threads, search]);

  const commitRename = async (id: string) => {
    if (draft.trim()) await patchThread(id, { title: draft.trim() });
    setEditing(null);
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-head">
        <div className="brand">
          cha<span>ti</span>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <button className="btn primary" onClick={newThread} title="New thread">
          <Icon name="plus" size={15} />
          New
        </button>
      </div>

      <div className="sidebar-search">
        <input
          placeholder="Search threads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="thread-list">
        {filtered.length === 0 && (
          <div style={{ padding: 12, color: "var(--muted)", fontSize: 12.5, textAlign: "center" }}>
            No threads yet.
          </div>
        )}
        {filtered.map((t) => (
          <div
            key={t.id}
            className={`thread-item ${t.id === activeId ? "active" : ""}`}
            onClick={() => selectThread(t.id)}
          >
            {editing === t.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => commitRename(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(t.id);
                  if (e.key === "Escape") setEditing(null);
                }}
              />
            ) : (
              <div className="t-title" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {t.pinned ? <Icon name="pin" size={12} /> : null}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
              </div>
            )}
            <div className="t-preview">{t.preview || "—"}</div>
            <div className="t-actions" onClick={(e) => e.stopPropagation()}>
              <button
                className="btn ghost icon"
                title="Rename"
                onClick={() => {
                  setEditing(t.id);
                  setDraft(t.title);
                }}
              >
                <Icon name="edit" size={13} />
              </button>
              <button
                className="btn ghost icon"
                title={t.pinned ? "Unpin" : "Pin"}
                onClick={() => patchThread(t.id, { pinned: !t.pinned })}
              >
                <Icon name="pin" size={13} />
              </button>
              <button
                className="btn ghost icon danger"
                title="Delete"
                onClick={() => {
                  if (confirm("Delete this thread and all its messages?")) deleteThread(t.id);
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <button className="btn" onClick={onOpenMemory} title="Long-term memory">
          <Icon name="brain" size={14} />
          Memory
          {memories.length > 0 ? <span className="badge purple">{memories.length}</span> : null}
        </button>
        <button className="btn" onClick={onOpenPrompts}>
          <Icon name="book" size={14} />
          Prompts
        </button>
        <button className="btn" onClick={onOpenSettings}>
          <Icon name="settings" size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { useChat } from "../lib/store";
import type { Artifact } from "../lib/types";
import Icon from "./Icon";
import Markdown from "./Markdown";

const KINDS: Artifact["kind"][] = ["markdown", "html", "svg", "code", "text", "json", "csv", "mermaid"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/\r\n/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function Preview({ artifact }: { artifact: Artifact }) {
  const { kind, content, language, title } = artifact;

  if (kind === "html") {
    return (
      <iframe
        className="artifact-frame"
        title={title}
        sandbox="allow-scripts allow-popups allow-forms allow-modals"
        srcDoc={content}
      />
    );
  }

  if (kind === "svg") {
    return <div className="artifact-render" dangerouslySetInnerHTML={{ __html: content }} />;
  }

  if (kind === "code") {
    return (
      <div className="msg-content artifact-scroll">
        <Markdown>{`\`\`\`${language || ""}\n${content}\n\`\`\``}</Markdown>
      </div>
    );
  }

  if (kind === "json") {
    let pretty = content;
    try {
      pretty = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      /* keep raw */
    }
    return (
      <div className="msg-content artifact-scroll">
        <Markdown>{`\`\`\`json\n${pretty}\n\`\`\``}</Markdown>
      </div>
    );
  }

  if (kind === "csv") {
    const rows = parseCsv(content);
    if (!rows.length) return <div className="artifact-render" />;
    const [head, ...body] = rows;
    return (
      <div className="artifact-scroll">
        <table className="csv-table">
          <thead>
            <tr>
              {head.map((cell, i) => (
                <th key={i}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (kind === "text") {
    return <pre className="artifact-pre artifact-scroll">{content}</pre>;
  }

  if (kind === "mermaid") {
    return (
      <div className="artifact-scroll">
        <pre className="artifact-pre">{content}</pre>
        <div className="hint" style={{ marginTop: 8 }}>
          Mermaid source — export to render with a Mermaid tool.
        </div>
      </div>
    );
  }

  return (
    <div className="msg-content artifact-scroll">
      <Markdown>{content}</Markdown>
    </div>
  );
}

export default function CanvasPanel({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const { artifacts, activeId, updateArtifact, removeArtifact, addArtifact } = useChat();
  const selected = useMemo(
    () => artifacts.find((a) => a.id === selectedId) || artifacts[artifacts.length - 1] || null,
    [artifacts, selectedId],
  );
  const [draft, setDraft] = useState<Artifact | null>(null);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [saved, setSaved] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
    setSaved(false);
    setMode("preview");
  }, [selected?.id]);

  if (!draft) {
    return (
      <aside className="canvas">
        <div className="canvas-head">
          <Icon name="layers" size={15} />
          <div className="title">Canvas</div>
          <div style={{ flex: 1 }} />
          <button className="btn ghost icon" onClick={onClose} title="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="empty" style={{ padding: 24 }}>
          <Icon name="file" size={26} />
          <div style={{ color: "var(--text-strong)" }}>No artifacts yet</div>
          <div style={{ fontSize: 12.5 }}>
            When the model produces a document, page, SVG, chart or code with the <b>canvas</b> skill
            on, it appears here and renders natively.
          </div>
          <button
            className="btn"
            disabled={!activeId}
            onClick={() => activeId && addArtifact(activeId, { title: "Untitled note", kind: "markdown", content: "" })}
          >
            <Icon name="plus" size={14} />
            New artifact
          </button>
        </div>
      </aside>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(selected);

  const save = async () => {
    if (!draft) return;
    await updateArtifact(draft.id, {
      title: draft.title,
      kind: draft.kind,
      language: draft.language,
      content: draft.content,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const download = (fmt: string) => {
    const a = document.createElement("a");
    a.href = api.exportUrl(draft.id, fmt);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const exportPdf = () => {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    let body: string;
    if (draft.kind === "html" || draft.kind === "svg") {
      body = draft.content;
    } else if (mode === "preview" && previewRef.current?.innerHTML) {
      body = previewRef.current.innerHTML;
    } else {
      body = `<pre style="white-space:pre-wrap">${escapeHtml(draft.content)}</pre>`;
    }
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(draft.title)}</title>` +
        `<style>body{font-family:Georgia,'Times New Roman',serif;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.7;color:#111}` +
        `pre,code{font-family:monospace;white-space:pre-wrap}pre{background:#f4f4f4;padding:12px;border-radius:6px}` +
        `img,svg{max-width:100%}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 10px}` +
        `@media print{body{margin:0}}</style></head><body>${body}</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  const showSvg = draft.kind === "svg";
  const showJson = draft.kind === "json";

  return (
    <aside className="canvas">
      <div className="canvas-head">
        <Icon name="layers" size={15} />
        <div className="title">Canvas</div>
        <span className="badge orange">{artifacts.length}</span>
        <div style={{ flex: 1 }} />
        <button
          className="btn ghost icon"
          title="New artifact"
          disabled={!activeId}
          onClick={() => activeId && addArtifact(activeId, { title: "Untitled note", kind: "markdown", content: "" })}
        >
          <Icon name="plus" size={15} />
        </button>
        <button className="btn ghost icon" onClick={onClose} title="Close">
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="canvas-list">
        {artifacts.map((a) => (
          <button
            key={a.id}
            className={`canvas-tab ${a.id === draft.id ? "active" : ""}`}
            onClick={() => onSelect(a.id)}
            title={a.title}
          >
            {a.title || "Untitled"}
          </button>
        ))}
      </div>

      <div className="canvas-body">
        <div className="canvas-meta">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title"
          />
          <select
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as Artifact["kind"] })}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          {draft.kind === "code" && (
            <input
              style={{ width: 110 }}
              value={draft.language}
              onChange={(e) => setDraft({ ...draft, language: e.target.value })}
              placeholder="lang"
            />
          )}
        </div>

        <div className="canvas-viewtoggle">
          <button
            className={`seg ${mode === "preview" ? "on" : ""}`}
            onClick={() => setMode("preview")}
          >
            <Icon name="play" size={12} /> Preview
          </button>
          <button className={`seg ${mode === "edit" ? "on" : ""}`} onClick={() => setMode("edit")}>
            <Icon name="edit" size={12} /> Edit
          </button>
        </div>

        <div className="canvas-previewwrap" ref={previewRef}>
          {mode === "edit" ? (
            <textarea
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              spellCheck={false}
            />
          ) : (
            <Preview artifact={draft} />
          )}
        </div>

        <div className="canvas-actions">
          <button className="btn primary" onClick={save} disabled={!dirty}>
            <Icon name={saved ? "check" : "download"} size={14} />
            {saved ? "Saved" : "Save"}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={exportPdf} title="Print / Save as PDF">
            <Icon name="download" size={14} />
            PDF
          </button>
          <button className="btn" onClick={() => download("docx")} title="Export Word document">
            .docx
          </button>
          <button className="btn" onClick={() => download("md")}>
            .md
          </button>
          <button className="btn" onClick={() => download("html")}>
            .html
          </button>
          {showSvg && (
            <button className="btn" onClick={() => download("svg")}>
              .svg
            </button>
          )}
          {showJson && (
            <button className="btn" onClick={() => download("json")}>
              .json
            </button>
          )}
          <button className="btn" onClick={() => download("txt")}>
            .txt
          </button>
          <button
            className="btn ghost danger icon"
            title="Delete artifact"
            onClick={async () => {
              if (confirm("Delete this artifact?")) {
                await api.deleteArtifact(draft.id);
                removeArtifact(draft.id);
                onSelect(null);
              }
            }}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

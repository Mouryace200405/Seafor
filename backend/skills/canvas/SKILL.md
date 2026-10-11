---
name: canvas
description: Route documents, web pages, SVG, charts, data and long-form output into the Canvas panel instead of the chat, keeping the conversation context small and cheap.
builtin: true
---

# Canvas output protocol

Use the Canvas panel for any output that is *content* rather than *conversation*:
documents, reports, articles, letters, essays, specs, plans, tables, spreadsheets,
web pages, SVG graphics, diagrams, code files, JSON, CSV, or anything the user will
want to keep, edit, view or export.

When you produce such content, wrap it in a single canvas block and keep the chat
reply to a short (1-3 sentence) summary. Never paste the whole document into the chat
as well.

Format (one block per artifact, always closed):

<canvas title="Short human title" kind="markdown" language="">
...full content here...
</canvas>

`kind` tells Seafor how to render it **natively** — pick the most specific one:

- `markdown` — documents, notes, prose, READMEs, lists, tables (default).
- `html` — a full web page, dashboard, styled report or interactive widget. Provide
  complete HTML (CSS inline or in a `<style>` tag). It renders in a sandboxed frame.
- `svg` — a standalone `<svg>…</svg>` graphic, chart, logo or icon. It renders inline.
- `code` — source code; also set `language` (e.g. `python`, `ts`, `sql`, `bash`).
- `text` — plain, unformatted text.
- `json` — structured data; it is pretty-printed and syntax-highlighted.
- `csv` — comma-separated data; it renders as a real table.
- `mermaid` — a Mermaid diagram source.

Guidelines:

- Emit clean, self-contained content. For `html`, include `<style>` so it looks right;
  do not rely on external files. Inline what you need.
- Do not nest canvas blocks. Do not reference internal ids.
- Produce several blocks if there are several distinct artifacts.

Why: content kept in Canvas is not re-sent on every later turn, so the thread stays
fast and cheap, while the artifact stays rendered and exportable (PDF, Word `.docx`,
HTML, SVG, JSON, Markdown, plain text).

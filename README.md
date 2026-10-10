# chati

A fast, lightweight chat harness for **OpenRouter** models, with **model-switch-safe
context**, a **Canvas** for generated documents/code, **skills**, **TTS**, a **prompt
library**, and an **Ayu Dark** interface.

Stack: **React (Vite + TypeScript)** · **FastAPI** · **PostgreSQL**.

---

## Why it's different

- **Context never lost when you switch models.** A thread's history is canonical and
  model-agnostic; the request payload is rebuilt from it on every turn. Switch from a
  reasoning model to a code model mid-thread and it still knows everything.
- **Long threads stay cheap.** When a thread approaches the model's context window,
  the oldest messages are compacted into a rolling summary (kept in Postgres) and only
  the summary + recent turns are sent. Configurable budget.
- **Canvas keeps tokens down.** The built-in **canvas** skill tells the model to put
  documents/code into `<canvas>` blocks. The backend extracts them into **artifacts**,
  replaces them in the transcript with a one-line reference, and lets you view, edit and
  export them (Word `.docx`, `.md`, `.html`, `.txt`). Content in Canvas is *not* re-sent
  every turn, so the thread stays fast and cheap.

---

## Features

| Area | What you get |
| --- | --- |
| Chat | Streaming responses, per-message reasoning panel, copy, retry/regenerate, delete |
| Models | Searchable picker over the **live** OpenRouter catalog (context + price shown) |
| Threads | Each conversation is a **thread**: search, rename, pin, delete, persisted |
| Context | Canonical history + automatic rolling-summary compaction + model switch safe |
| Canvas | Artifact panel (left-corner toggle), edit, live preview, export to `.docx`/`.md`/`.html`/`.txt` |
| Skills | Toggleable per-thread skills: `canvas` (default), `doc-writer`, `code`, `summarizer` — drop new ones in `backend/skills/<name>/SKILL.md` |
| Prompt library | Save/reuse prompts; insert into the composer |
| TTS | Browser text-to-speech: read any reply, or auto-read all (voice + rate in Settings) |
| Settings | OpenRouter API key, default model, base system prompt, temperature, max tokens, context budget |
| Theme | Ayu Dark, single-file CSS, no UI framework |

---

## Layout

```
chati/
├── run.sh                 # one-command launcher (dev or --prod)
├── docker-compose.yml     # optional Postgres
├── .env.example
├── backend/
│   ├── requirements.txt
│   ├── skills/<name>/SKILL.md   # opencode-compatible skills (markdown + frontmatter)
│   └── app/
│       ├── main.py        # FastAPI app; also serves the built frontend
│       ├── config.py      # env settings
│       ├── database.py    # async engine + session
│       ├── models.py      # settings, threads, messages, artifacts, prompts
│       ├── schemas.py     # pydantic request/response models
│       ├── context.py     # ★ context engineering: build / compact / budget
│       ├── openrouter.py  # models list + streaming + non-stream completion
│       ├── skills.py      # skill loader + system-context builder
│       ├── artifacts.py   # ★ canvas parsing + exporters (docx/html/md/txt)
│       ├── settings_store.py
│       └── routers/       # settings, threads, chat, models, prompts, skills, artifacts
└── frontend/
    ├── vite.config.ts     # dev proxy /api -> :8000
    └── src/
        ├── styles.css     # Ayu Dark theme
        ├── lib/           # api client + SSE, store (state), tts, types
        └── components/    # Sidebar, ChatWindow, Message, Composer,
                           # CanvasPanel, ModelPicker, SkillsMenu,
                           # SettingsModal, PromptLibrary, Icon, Markdown
```

---

## Quick start

### 1. Database

Postgres must be running. The launcher will create the `chati` role + database if it
can (using `psql`). Manual equivalent:

```bash
psql -d postgres -c "CREATE ROLE chati LOGIN PASSWORD 'chati' CREATEDB;"
psql -d postgres -c "CREATE DATABASE chati OWNER chati;"
```

Prefer Docker? `docker compose up -d` (maps to host port **5433**) and set
`DATABASE_URL=postgresql+asyncpg://chati:chati@127.0.0.1:5433/chati` in `backend/.env`.

### 2. Run

```bash
./run.sh            # dev:  http://127.0.0.1:5173   (vite) + backend :8000
./run.sh --prod     # prod: build frontend, serve all on http://127.0.0.1:8000
```

The script creates the venv, installs backend + frontend deps, and starts everything.
Ctrl-C stops both processes.

### 3. Add your OpenRouter key

Open the app → **Settings** → paste your `sk-or-…` key → Save. It is stored in Postgres
(and used as an env fallback if `OPENROUTER_API_KEY` is set). The default model is
**`cohere/north-mini-code:free`**; change it per-thread in the model picker or globally
in Settings.

---

## How context engineering works

1. Every message is stored once in `messages`, independent of any model.
2. On each turn, `context.build_messages()` composes:
   - base system prompt (thread → global)
   - full body of **enabled skills**
   - a one-line manifest of disabled skills
   - a rolling **summary** of compacted history (if any)
   - the recent messages (everything after `summary_cursor`)
3. `context.needs_compaction()` estimates tokens against
   `model_context_length × context_fraction`. If over budget, `context.compact()`
   summarizes the oldest messages and advances `summary_cursor`. Recent turns are
   always kept verbatim (`keep_recent_messages`).
4. Models that reject the `system` role (e.g. some reasoning models) get the system
   text folded into the first user message automatically.

Because the payload is rebuilt from canonical history every time, **switching models
mid-thread preserves full context** — verified: after switching models, the new model
recalled a fact stated under the previous model.

## How the Canvas works

With the `canvas` skill on (default), the model wraps substantial output like:

```
<canvas title="Q3 Report" kind="markdown" language="">
# Q3 Report
...
</canvas>
```

The backend (`artifacts.parse_canvas_blocks`) extracts it, stores an **Artifact**, and
replaces the block in the stored message with `[canvas: Q3 Report]`. That reference is
what future turns send, so large content costs ~a few tokens per turn instead of
hundreds. Artifacts are editable in the panel and exportable to `.docx`/`.md`/`.html`/`.txt`.

---

## Notes

- **Free models** are shared and can be rate-limited or momentarily unavailable. If a
  call errors, the error is streamed and shown on the message — try another model. Only
  models whose id ends in `:free` cost nothing.
- **Reasoning models** stream their thinking into a collapsible *Reasoning* panel.
- The production bundle is a single ~160 KB gzip JS file (markdown + syntax highlighting).
- No accounts, no telemetry. One API key, stored locally.

## Troubleshooting

- **`No OpenRouter API key set`** → Settings → paste key.
- **Models list empty** → backend can't reach `openrouter.ai`; check network. Retry in the picker.
- **`401`/`User not found`** → bad key.
- **DB connection error** → ensure Postgres is running and the `chati` db exists (see step 1).

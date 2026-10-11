---
name: claude-api
description: Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.
---

# Claude API Reference

Quick reference for building with the Anthropic SDK.

## Current Models (2026-10)

| Model | Model ID | Context | Input $/1M | Output $/1M |
|-------|----------|---------|------------|-------------|
| Claude Opus 5.5 | `claude-opus-5-5` | 1M | $4.00 | $20.00 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 1M | $2.00 | $10.00 |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 1M | $0.10 | $0.50 |

**Default: `claude-opus-5-5`** unless user specifies otherwise.

## Key API Patterns

### Streaming (recommended for long outputs)
```python
async with client.messages.stream(
    model="claude-opus-5-5",
    messages=[{"role": "user", "content": "..."}],
    max_tokens=4096,
    thinking={"type": "adaptive"},
) as stream:
    async for event in stream:
        if event.type == "content_block_delta":
            print(event.delta.text, end="")
```

### Tool Use
```python
tools = [{
    "name": "get_weather",
    "description": "Get weather for a location",
    "input_schema": {
        "type": "object",
        "properties": {"location": {"type": "string"}},
        "required": ["location"]
    }
}]

response = await client.messages.create(
    model="claude-opus-5-5",
    messages=[{"role": "user", "content": "Weather in NYC?"}],
    tools=tools,
    max_tokens=1024,
)
```

### Caching (prompt caching)
```python
messages = [{
    "role": "user",
    "content": [
        {"type": "text", "text": large_document, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "Summarize this"}
    ]
}]
```

### Token Counting
```python
count = await client.messages.count_tokens(
    model="claude-opus-5-5",
    messages=[...]
)
```

## Thinking & Effort

Use `thinking: {"type": "adaptive"}` with `output_config: {"effort": "high"}` for complex tasks. Effort levels: `low`, `medium`, `high`, `xhigh`, `max`. Default `high` (Opus 5.5 default `medium`).

## Model Migration Key Changes (Opus 5.5)

- `thinking: {type: "disabled"}` → 400 error (use `adaptive`)
- Forced `tool_choice: "any"` → 400 (use `auto` + `strict: true`)
- Thinking blocks tied to model/conversation (preserved thinking)
- `budget_tokens` removed (deprecated)

## Error Handling

- `stop_reason: "refusal"` → safety classifier declined
- `stop_reason: "max_tokens"` → output truncated
- `stop_reason: "tool_use"` → tool call expected
- HTTP 429 → rate limit, implement exponential backoff
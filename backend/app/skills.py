from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parent.parent / "skills"

CANVAS_SKILL = "canvas"


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    body: str
    builtin: bool = False


def _parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    meta: dict[str, str] = {}
    if not text.startswith("---"):
        return meta, text
    end = text.find("\n---", 3)
    if end == -1:
        return meta, text
    for line in text[3:end].strip().splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, text[end + 4 :].strip()


@lru_cache
def load_skills() -> list[Skill]:
    skills: list[Skill] = []
    if not SKILLS_DIR.exists():
        return skills
    for skill_md in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        raw = skill_md.read_text(encoding="utf-8")
        meta, body = _parse_frontmatter(raw)
        name = meta.get("name") or skill_md.parent.name
        skills.append(
            Skill(
                name=name,
                description=meta.get("description", ""),
                body=body,
                builtin=meta.get("builtin", "").lower() == "true",
            )
        )
    return skills


def get_skill(name: str) -> Skill | None:
    for skill in load_skills():
        if skill.name == name:
            return skill
    return None


def default_enabled_skills() -> list[str]:
    return [CANVAS_SKILL, "caveman"]


def build_system_context(
    enabled_skills: list[str],
    base_prompt: str = "",
    memories: list[str] | None = None,
) -> str:
    """Compose the system message in a clear, ordered structure:

    1. base persona (how to behave)
    2. long-term memory about the user (facts to respect)
    3. active skills (full instructions to follow)
    4. manifest of other skills available to enable

    Memories give every thread (including brand-new ones) durable context about
    the user, so switching models or starting a new thread never "forgets" them.
    """
    parts: list[str] = []

    persona = base_prompt.strip() or "You are chati, a fast, concise and precise assistant."
    parts.append(f"# Role\n{persona}")

    if memories:
        items = "\n".join(f"- {m}" for m in memories)
        parts.append(
            "# What you remember about the user\n"
            "Durable facts learned in earlier conversations. Treat them as true, use "
            "them naturally when relevant, and never invent or contradict them.\n" + items
        )

    all_skills = {s.name: s for s in load_skills()}
    enabled = [all_skills[n] for n in enabled_skills if n in all_skills]

    if enabled:
        names = ", ".join(s.name for s in enabled)
        parts.append(f"# Active skills\nCurrently active: {names}. Follow each skill's instructions precisely.")
        for skill in enabled:
            parts.append(f"## Skill: {skill.name}\n{skill.body}")

    disabled = [s for name, s in all_skills.items() if name not in enabled_skills]
    if disabled:
        lines = "\n".join(f"- {s.name}: {s.description}" for s in disabled)
        parts.append(
            "# Other skills the user can enable\n"
            "Not active now. Do not follow them unless the user turns them on.\n" + lines
        )

    return "\n\n".join(parts).strip()

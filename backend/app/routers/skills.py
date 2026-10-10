from __future__ import annotations

from fastapi import APIRouter

from ..schemas import SkillOut
from ..skills import CANVAS_SKILL, load_skills

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("", response_model=list[SkillOut])
async def list_skills():
    return [
        SkillOut(name=s.name, description=s.description, builtin=s.builtin or s.name == CANVAS_SKILL)
        for s in load_skills()
    ]

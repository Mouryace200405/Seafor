from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import artifacts as art
from ..database import get_session
from ..models import Artifact
from ..schemas import ArtifactCreate, ArtifactOut, ArtifactUpdate

router = APIRouter(prefix="/api", tags=["artifacts"])


@router.get("/threads/{thread_id}/artifacts", response_model=list[ArtifactOut])
async def list_artifacts(thread_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    rows = await session.execute(
        select(Artifact).where(Artifact.thread_id == thread_id).order_by(Artifact.created_at.asc())
    )
    return list(rows.scalars().all())


@router.post("/threads/{thread_id}/artifacts", response_model=ArtifactOut)
async def create_artifact(thread_id: uuid.UUID, payload: ArtifactCreate, session: AsyncSession = Depends(get_session)):
    artifact = Artifact(
        thread_id=thread_id,
        message_id=payload.message_id,
        title=payload.title,
        kind=payload.kind,
        language=payload.language,
        content=payload.content,
    )
    session.add(artifact)
    await session.commit()
    await session.refresh(artifact)
    return artifact


@router.patch("/artifacts/{artifact_id}", response_model=ArtifactOut)
async def update_artifact(artifact_id: uuid.UUID, payload: ArtifactUpdate, session: AsyncSession = Depends(get_session)):
    artifact = await session.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(404, "Artifact not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(artifact, key, value)
    await session.commit()
    await session.refresh(artifact)
    return artifact


@router.delete("/artifacts/{artifact_id}")
async def delete_artifact(artifact_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    artifact = await session.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(404, "Artifact not found")
    await session.delete(artifact)
    await session.commit()
    return {"ok": True}


def _safe_name(title: str) -> str:
    name = "".join(c for c in title if c.isalnum() or c in " -_").strip() or "artifact"
    return name.replace(" ", "_")[:60]


@router.get("/artifacts/{artifact_id}/export")
async def export_artifact(artifact_id: uuid.UUID, fmt: str = "docx", session: AsyncSession = Depends(get_session)):
    artifact = await session.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(404, "Artifact not found")

    base = _safe_name(artifact.title)
    fmt = fmt.lower()
    if fmt == "docx":
        data = art.to_docx(artifact.title, artifact.content)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif fmt == "md":
        data = art.to_markdown(artifact.title, artifact.content).encode("utf-8")
        media = "text/markdown; charset=utf-8"
    elif fmt in ("html", "htm"):
        data = art.to_html(artifact.title, artifact.content, artifact.kind).encode("utf-8")
        media = "text/html; charset=utf-8"
        fmt = "html"
    elif fmt == "svg":
        data = art.to_svg(artifact.content).encode("utf-8")
        media = "image/svg+xml; charset=utf-8"
    elif fmt == "json":
        data = art.to_json(artifact.content).encode("utf-8")
        media = "application/json; charset=utf-8"
    elif fmt == "txt":
        data = art.to_text(artifact.title, artifact.content).encode("utf-8")
        media = "text/plain; charset=utf-8"
    else:
        raise HTTPException(400, "Unsupported format")

    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{base}.{fmt}"'},
    )

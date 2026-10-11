from __future__ import annotations

import asyncio
import os
import subprocess
import uuid
from pathlib import Path
from starlette.background import BackgroundTask

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/tts", tags=["tts"])

PIPER_BIN = "piper"
MODEL_PATH = Path("/home/ivan/chati/backend/piper_voices/en_GB-southern_english_female-low.onnx")
CONFIG_PATH = Path("/home/ivan/chati/backend/piper_voices/en_GB-southern_english_female-low.onnx.json")


class TTSRequest(BaseModel):
    text: str
    speed: float = 1.0


def _check_piper():
    if not MODEL_PATH.exists() or not CONFIG_PATH.exists():
        raise HTTPException(500, "Piper voice model not found")
    try:
        subprocess.run([PIPER_BIN, "--help"], capture_output=True, check=True, timeout=5)
    except Exception:
        raise HTTPException(500, "Piper binary not available")


@router.post("/synthesize")
async def synthesize(req: TTSRequest):
    _check_piper()
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(400, "Empty text")
    if len(text) > 2000:
        text = text[:2000]

    import uuid
    out_path = f"/tmp/tts_{uuid.uuid4().hex}.wav"

    try:
        cmd = [
            PIPER_BIN,
            "-m", str(MODEL_PATH),
            "-c", str(CONFIG_PATH),
            "-f", out_path,
            "--length-scale", str(1.0 / max(0.25, min(req.speed, 3.0))),
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(input=text.encode("utf-8"))
        if proc.returncode != 0:
            raise HTTPException(500, f"Piper failed: {stderr.decode().strip()}")
        if not os.path.exists(out_path) or os.path.getsize(out_path) == 0:
            raise HTTPException(500, "Piper produced empty output")
        return FileResponse(
            out_path,
            media_type="audio/wav",
            filename="tts.wav",
            background=BackgroundTask(lambda: os.unlink(out_path) if os.path.exists(out_path) else None),
        )
    except HTTPException:
        raise
    except Exception:
        try:
            os.unlink(out_path)
        except Exception:
            pass
        raise


@router.get("/voices")
async def list_voices():
    return {
        "voices": [
            {
                "id": "en_GB-southern_english_female-low",
                "name": "Southern English Female (Low)",
                "lang": "en-GB",
                "quality": "low",
                "size_mb": 63.1,
            }
        ],
        "default": "en_GB-southern_english_female-low",
    }
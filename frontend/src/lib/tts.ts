let currentAudio: HTMLAudioElement | null = null;

export function getVoices(): SpeechSynthesisVoice[] {
  return [];
}

export function onVoicesReady(cb: () => void): () => void {
  cb();
  return () => {};
}

export function isSupported(): boolean {
  return true;
}

export function unlockTTS(): void {
}

export function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/\[canvas:[^\]]*\]/g, " canvas artifact ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>~]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(
  text: string,
  opts: { voice?: string; rate?: number } = {},
  onError?: (msg: string) => void,
): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const clean = cleanForSpeech(text);
  if (!clean) return;
  const url = `/api/tts/synthesize`;
  currentAudio = new Audio();
  currentAudio.src = url;
  const body = JSON.stringify({ text: clean, speed: opts.rate ?? 1 });
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body })
    .then((r) => {
      if (!r.ok) throw new Error(`TTS ${r.status}`);
      return r.blob();
    })
    .then((blob) => {
      currentAudio!.src = URL.createObjectURL(blob);
      currentAudio!.play().catch((e) => onError?.(e.message));
    })
    .catch((e) => onError?.(e.message));
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

export function isSpeaking(): boolean {
  return !!currentAudio && !currentAudio.paused && !currentAudio.ended;
}
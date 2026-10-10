let currentUtterance: SpeechSynthesisUtterance | null = null;

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

export function onVoicesReady(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  const handler = () => cb();
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  if (window.speechSynthesis.getVoices().length) cb();
  return () => window.speechSynthesis.removeEventListener("voiceschanged", handler);
}

/** Strip markdown / canvas markers so TTS reads clean prose. */
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

export function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, opts: { voice?: string; rate?: number } = {}): void {
  if (!isSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(cleanForSpeech(text));
  utter.rate = opts.rate ?? 1;
  if (opts.voice) {
    const match = getVoices().find((v) => v.name === opts.voice);
    if (match) utter.voice = match;
  }
  utter.onend = () => {
    if (currentUtterance === utter) currentUtterance = null;
  };
  currentUtterance = utter;
  synth.speak(utter);
}

export function stopSpeaking(): void {
  if (!isSupported()) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return isSupported() && window.speechSynthesis.speaking;
}

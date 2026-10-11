import { useEffect, useState } from "react";
import { useChat } from "../lib/store";
import { getVoices, isSupported, onVoicesReady, speak } from "../lib/tts";
import Icon from "./Icon";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, saveSettings, models, setNotice } = useChat();
  const [defaultModel, setDefaultModel] = useState(settings?.default_model || "");
  const [systemPrompt, setSystemPrompt] = useState(settings?.system_prompt || "");
  const [temperature, setTemperature] = useState(settings?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(settings?.max_tokens ?? 0);
  const [voice, setVoice] = useState(settings?.tts_voice || "");
  const [rate, setRate] = useState(settings?.tts_rate ?? 1);
  const [autoTts, setAutoTts] = useState(settings?.auto_tts ?? false);
  const [ctxFraction, setCtxFraction] = useState(settings?.context_fraction ?? 0.72);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(getVoices());
  const [saving, setSaving] = useState(false);

  useEffect(() => onVoicesReady(() => setVoices(getVoices())), []);

  const testVoice = () => {
    if (!isSupported()) {
      setNotice("This browser does not support speech synthesis.");
      return;
    }
    if (!voices.length) {
      setNotice("No system voices found. Install a TTS engine (e.g. speech-dispatcher + espeak-ng), then reload.");
      return;
    }
    speak("This is Seafor. Text to speech is working.", { voice, rate }, (m) => setNotice(m));
  };

  const save = async () => {
    setSaving(true);
    const payload: any = {
      default_model: defaultModel,
      system_prompt: systemPrompt,
      temperature,
      max_tokens: maxTokens,
      tts_voice: voice,
      tts_rate: rate,
      auto_tts: autoTts,
      context_fraction: ctxFraction,
    };
    await saveSettings(payload);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>Settings</h3>
          <button className="btn ghost icon" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>API Keys</label>
            <span className="hint">All API keys are read from .env file only. Edit backend/.env to configure OpenRouter, Gemini, Groq, or Ollama.</span>
          </div>

          <div className="field">
            <label>Default model</label>
            <input list="model-list" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} />
            <datalist id="model-list">
              {models.slice(0, 300).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </datalist>
          </div>

          <div className="field">
            <label>Base system prompt</label>
            <textarea rows={3} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
          </div>

          <div className="field">
            <label>Temperature</label>
            <div className="row">
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="val">{temperature.toFixed(2)}</span>
            </div>
          </div>

          <div className="field">
            <label>Max output tokens (0 = model default)</label>
            <input
              type="number"
              min={0}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value || "0", 10))}
            />
          </div>

          <div className="field">
            <label>Context budget (fraction of model window used for input)</label>
            <div className="row">
              <input
                type="range"
                min={0.3}
                max={0.95}
                step={0.01}
                value={ctxFraction}
                onChange={(e) => setCtxFraction(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="val">{Math.round(ctxFraction * 100)}%</span>
            </div>
            <span className="hint">
              Older messages are compacted into a rolling summary to stay within this budget. Switching
              models never drops context.
            </span>
          </div>

          <div className="field">
            <label>Text-to-speech</label>
            <div className="row">
              <select style={{ flex: 1 }} value={voice} onChange={(e) => setVoice(e.target.value)}>
                <option value="">System default voice</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                style={{ width: 110 }}
              />
              <span className="val">{rate.toFixed(2)}x</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn" onClick={testVoice} type="button">
                <Icon name="volume" size={14} />
                Test voice
              </button>
              <span className="hint">
                {voices.length ? `${voices.length} voices available` : "No system voices detected"}
              </span>
            </div>
            <label className="check-item" style={{ paddingLeft: 0 }}>
              <input type="checkbox" checked={autoTts} onChange={(e) => setAutoTts(e.target.checked)} />
              <span>Auto-read assistant replies</span>
            </label>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
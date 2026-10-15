import { useEffect, useState } from "react";
import { useChat } from "../lib/store";
import { getVoices, isSupported, onVoicesReady, speak } from "../lib/tts";
import type { ModelInfo } from "../lib/types";
import Icon from "./Icon";
import ModelSelect from "./ModelSelect";

function MultiModelField({
  label,
  hint,
  value,
  onChange,
  models,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  models: ModelInfo[];
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <ModelSelect
        models={models}
        onPick={(id) => {
          if (!value.includes(id)) onChange([...value, id]);
        }}
        title="Pick a model"
        trigger={
          <button className="btn" type="button" style={{ width: "100%", justifyContent: "flex-start" }}>
            <Icon name="plus" size={14} />
            Add model…
            <span style={{ flex: 1 }} />
            <Icon name="chevron" size={13} />
          </button>
        }
      />
      <div className="eft-chips">
        {value.length === 0 && <span className="hint">No models selected.</span>}
        {value.map((v) => (
          <span key={v} className="eft-chip" title={v}>
            <span className="eft-chip-name">{v}</span>
            <button
              className="btn ghost icon"
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              title="Remove"
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
      </div>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

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
  const [votingModels, setVotingModels] = useState<string[]>(settings?.voting_models ?? []);
  const [votingConsistency, setVotingConsistency] = useState(settings?.voting_consistency ?? "majority");
  const [votingTieBreak, setVotingTieBreak] = useState(settings?.voting_tie_break ?? "random");
  const [dictGenerators, setDictGenerators] = useState<string[]>(settings?.dictatorship_generators ?? []);
  const [dictJudge, setDictJudge] = useState(settings?.dictatorship_judge ?? "");
  const [routingRouterModel, setRoutingRouterModel] = useState(settings?.routing_router_model ?? "");
  const [routingDecisionModel, setRoutingDecisionModel] = useState(settings?.routing_decision_model ?? "");
  const [routingSubmode, setRoutingSubmode] = useState(settings?.routing_submode ?? "llm");
  const [routingModels, setRoutingModels] = useState<Record<string, string>>(settings?.routing_models ?? {});
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
      voting_models: votingModels,
      voting_consistency: votingConsistency,
      voting_tie_break: votingTieBreak,
      dictatorship_generators: dictGenerators,
      dictatorship_judge: dictJudge,
      routing_router_model: routingRouterModel,
      routing_decision_model: routingDecisionModel,
      routing_submode: routingSubmode,
      routing_models: routingModels,
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

          <div className="eft-settings">
            <div className="eft-settings-title">
              <Icon name="sparkles" size={14} />
              EFT — ensemble strategies
            </div>

            <MultiModelField
              label="Voting models"
              hint="Used in EFT ▸ Voting. Pick any models you want; they answer and vote among themselves."
              value={votingModels}
              onChange={setVotingModels}
              models={models}
            />
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Consistency</label>
                <select value={votingConsistency} onChange={(e) => setVotingConsistency(e.target.value)}>
                  <option value="majority">majority</option>
                  <option value="strict">strict (unanimous)</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Tie-break</label>
                <select value={votingTieBreak} onChange={(e) => setVotingTieBreak(e.target.value)}>
                  <option value="random">random</option>
                  <option value="priority">priority</option>
                  <option value="report">report</option>
                </select>
              </div>
            </div>
            <span className="hint">
              Runs a single round: each selected model answers once, then each votes once
              (never for its own answer).
            </span>

            <MultiModelField
              label="Dictatorship generators"
              hint="Used in EFT ▸ Dictatorship. These propose answers; the judge below picks the best."
              value={dictGenerators}
              onChange={setDictGenerators}
              models={models}
            />
            <div className="field">
              <label>Dictatorship judge</label>
              <ModelSelect
                models={models}
                onPick={(id) => setDictJudge(id)}
                title="Pick the judge model"
                trigger={
                  <button className="btn" type="button" style={{ width: "100%", justifyContent: "flex-start" }}>
                    <Icon name="sparkles" size={14} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {dictJudge || "Pick a judge model…"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <Icon name="chevron" size={13} />
                  </button>
                }
              />
              <span className="hint">
                Use a strong, large-context model — it reads every generator answer twice (swapped).
              </span>
            </div>
            
            <div className="field">
              <label>Routing — sub-mode</label>
              <select value={routingSubmode} onChange={(e) => setRoutingSubmode(e.target.value)}>
                <option value="llm">1 · LLM understanding router (qwen)</option>
                <option value="decision">2 · system-1 decision router (logprobs)</option>
              </select>
              <span className="hint">
                Sub-mode 1 asks an LLM for one lane token. Sub-mode 2 scores each lane from a
                decision model's next-token probabilities (Ollama logprobs).
              </span>
            </div>
            <div className="field">
              <label>Routing — router model (sub-mode 1)</label>
              <ModelSelect
                models={models}
                onPick={(id) => setRoutingRouterModel(id)}
                title="Pick the LLM router model"
                trigger={
                  <button className="btn" type="button" style={{ width: "100%", justifyContent: "flex-start" }}>
                    <Icon name="sparkles" size={14} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {routingRouterModel || "Pick a router model…"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <Icon name="chevron" size={13} />
                  </button>
                }
              />
              <span className="hint">Classifies each prompt into a lane (temperature 0).</span>
            </div>
            <div className="field">
              <label>Routing — decision model (sub-mode 2)</label>
              <ModelSelect
                models={models}
                onPick={(id) => setRoutingDecisionModel(id)}
                title="Pick the system-1 decision model"
                trigger={
                  <button className="btn" type="button" style={{ width: "100%", justifyContent: "flex-start" }}>
                    <Icon name="brain" size={14} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {routingDecisionModel || "Pick a decision model…"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <Icon name="chevron" size={13} />
                  </button>
                }
              />
              <span className="hint">
                Must run on Ollama and support logprobs (e.g. tev1:4b). Scores each lane.
              </span>
            </div>
            {["coder","multimodal","reasoning","rag","general"].map((cat) => (
              <div className="field" key={cat}>
                <label>Routing → {cat}</label>
                <ModelSelect
                  models={models}
                  onPick={(id) =>
                    setRoutingModels((m) => ({ ...m, [cat]: id }))
                  }
                  title={`Pick model for ${cat}`}
                  trigger={
                    <button className="btn" type="button" style={{ width: "100%", justifyContent: "flex-start" }}>
                      <Icon name="code" size={14} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(routingModels as any)[cat] || "Pick model… (falls back to default)"}
                      </span>
                      <span style={{ flex: 1 }} />
                      <Icon name="chevron" size={13} />
                    </button>
                  }
                />
              </div>
            ))}

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
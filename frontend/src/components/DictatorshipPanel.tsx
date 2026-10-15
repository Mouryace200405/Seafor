import { useState } from "react";
import Icon from "./Icon";

interface Candidate {
  model: string;
  answer: string;
  score?: number;
  ok?: boolean;
}

interface Comparison {
  models: [string, string];
  winner: string;
  reason?: string;
}

function short(model: string): string {
  return model.includes("/") ? model.split("/", 2)[1] : model;
}

export default function DictatorshipPanel({ data }: { data: any }) {
  const [showRaw, setShowRaw] = useState(false);
  const isResult = data?.type === "dictatorship_result";
  const judge: string | undefined = data?.judge;
  const tieBreak: string | undefined = data?.tie_break;
  const winner: string | null = data?.winner ?? null;
  const candidates: Candidate[] = data?.candidates || [];
  const comparisons: Comparison[] = data?.comparisons || [];
  const scores: Record<string, number> = data?.scores || {};
  const points: Record<string, number> = data?.points || {};

  return (
    <div className="voting-panel">
      <div className="voting-head">
        <span className="badge purple">
          <Icon name="sparkles" size={11} />
          EFT Dictatorship
        </span>
        {judge ? <span className="badge" title="Judge model">judge: {short(judge)}</span> : null}
        {isResult && data?.unanimous ? <span className="badge green">unanimous</span> : null}
        {isResult && !data?.unanimous && winner ? <span className="badge orange">top scorer</span> : null}
        {isResult && !winner ? <span className="badge red">no clear winner</span> : null}
        {isResult && <span className="badge">{comparisons.length} pair{comparisons.length === 1 ? "" : "s"}</span>}
      </div>

      {candidates.length > 0 && (
        <div className="voting-candidates">
          {candidates.map((c) => (
            <div key={c.model} className={`voting-cand ${winner === c.model ? "win" : ""}`}>
              <div className="voting-cand-top">
                <span className="voting-model">{c.model}</span>
                <span className="badge" title="Tournament points — agreed win = 1, position-bias split = ½ each">
                  {points[c.model] != null ? points[c.model].toFixed(1) : (scores[c.model] ?? c.score ?? 0)}
                </span>
                {c.ok === false ? <span className="badge red">failed</span> : null}
              </div>
              <div className="voting-answer">{c.answer}</div>
            </div>
          ))}
        </div>
      )}

      {isResult && comparisons.length > 0 && (
        <div className="voting-rounds">
          <button className="btn ghost" onClick={() => setShowRaw((s) => !s)}>
            <Icon name="chevron" size={13} />
            {showRaw ? "Hide" : "Show"} pairwise judge detail
            {isResult && tieBreak ? (
              <span className="voting-order-chip" style={{ marginLeft: 8 }}>
                tie-break: {tieBreak}
              </span>
            ) : null}
          </button>
          {showRaw && (
            <div className="voting-rounds-body">
              {comparisons.map((c, i) => (
                <div className="voting-round" key={i}>
                  <div className="voting-round-title">
                    {short(c.models[0])} vs {short(c.models[1])}
                  </div>
                  <div className="voting-order">
                    {c.winner === "TIE" ? (
                      <span className="voting-order-chip">judge → TIE</span>
                    ) : (
                      <span className="voting-order-chip pos">judge → {short(c.winner)}</span>
                    )}
                    {c.reason ? (
                      <span className="voting-order-chip" title={c.reason}>
                        {c.reason.length > 90 ? c.reason.slice(0, 90) + "…" : c.reason}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

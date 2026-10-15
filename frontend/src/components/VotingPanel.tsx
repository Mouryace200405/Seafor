import { useState } from "react";
import Icon from "./Icon";

interface Cand {
  model: string;
  rid: string;
  answer: string;
  votes?: number;
  ok?: boolean;
}

interface RoundVote {
  judge: string;
  picked_label: string | null;
  picked_rid: string | null;
  reason: string;
  parsed: boolean;
  visible?: string[];
}

interface Position {
  label: string;
  rid: string;
  model: string;
}

interface Round {
  index: number;
  labels?: string[];
  order: RoundVote[];
  perm?: number[];
  positions?: Position[];
}

function short(model: string): string {
  const i = model.indexOf("/");
  return i >= 0 ? model.slice(i + 1) : model;
}

export default function VotingPanel({ voting }: { voting: any }) {
  const [openRounds, setOpenRounds] = useState(false);
  const isResult = voting?.type === "voting_result";

  const candidates: Cand[] = (voting?.candidates as Cand[]) || [];
  const rounds: Round[] = (voting?.rounds as Round[]) || [];
  const tally: Record<string, number> = voting?.tally || {};
  const ridToModel: Record<string, string> = {};
  for (const c of candidates) ridToModel[c.rid] = c.model;
  if (voting?.diagnostics?.rid_to_model) {
    Object.assign(ridToModel, voting.diagnostics.rid_to_model);
  }

  const winner: string | null = voting?.winner || null;
  const modelOf = (rid: string | null | undefined) =>
    rid ? ridToModel[rid] || rid : "—";

  const maxVotes = Math.max(1, ...Object.values(tally));

  return (
    <div className="voting-panel">
      <div className="voting-head">
        <span className="badge purple">
          <Icon name="sparkles" size={11} /> EFT voting
        </span>
        {isResult && winner ? (
          <span className="badge green" title="Winning model">
            winner: {winner}
          </span>
        ) : (
          <span className="badge" style={{ opacity: 0.7 }}>
            voting…
          </span>
        )}
        {isResult ? <span className="badge">{voting.consistency}</span> : null}
        {isResult ? <span className="badge">{voting.votes} votes</span> : null}
        {voting?.permutation ? <span className="badge">{voting.permutation}</span> : null}
      </div>

      {candidates.length > 0 && (
        <div className="voting-candidates">
          {candidates.map((c) => (
            <div
              key={c.rid}
              className={`voting-cand ${winner === c.model ? "win" : ""}`}
            >
              <div className="voting-cand-top">
                <span className="voting-model">{c.model}</span>
                <span className="voting-rid" title="Anonymous id used during judging">
                  {c.rid}
                </span>
                <span className="badge" title="Votes received">
                  {tally[c.rid] ?? c.votes ?? 0}
                </span>
                {c.ok === false ? <span className="badge red">failed</span> : null}
              </div>
              <div className="voting-answer">{c.answer}</div>
            </div>
          ))}
        </div>
      )}

      {Object.keys(tally).length > 0 && (
        <div className="voting-tally">
          {Object.entries(tally)
            .sort((a, b) => b[1] - a[1])
            .map(([rid, n]) => (
              <div className="voting-bar-row" key={rid}>
                <span className="voting-bar-name" title={modelOf(rid)}>
                  {ridToModel[rid] ? short(ridToModel[rid]) : rid}
                </span>
                <span className="voting-bar-track">
                  <span
                    className="voting-bar-fill"
                    style={{ width: `${(n / maxVotes) * 100}%` }}
                  />
                </span>
                <span className="voting-bar-count">{n}</span>
              </div>
            ))}
        </div>
      )}

      {isResult && rounds.length > 0 && (
        <div className="voting-rounds">
          <button
            className="btn ghost"
            onClick={() => setOpenRounds((s) => !s)}
          >
            <Icon name="chevron" size={13} />
            {openRounds ? "Hide" : "Show"} {rounds.length} voting round
            {rounds.length > 1 ? "s" : ""}
          </button>
          {openRounds && (
            <div className="voting-rounds-body">
              {rounds.map((r) => (
                <div className="voting-round" key={r.index}>
                  <div className="voting-round-title">Round {r.index + 1}</div>
                  {r.positions && (
                    <div className="voting-order" style={{ marginBottom: 6 }}>
                      {r.positions.map((p) => (
                        <span className="voting-order-chip pos" key={p.label}>
                          {p.label} = {short(p.model)}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="voting-order">
                    {r.order.map((v, i) => (
                      <span className="voting-order-chip" key={i} title={v.reason}>
                        {short(v.judge)} picks {v.picked_label || "?"} →{" "}
                        {modelOf(v.picked_rid)}
                        {v.parsed ? "" : " (unparsed)"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isResult && voting?.tie?.policy ? (
        <div className="voting-note">
          tie-break: {voting.tie.policy}
          {voting.tie.seed ? ` (seed ${voting.tie.seed})` : ""}
        </div>
      ) : null}
    </div>
  );
}

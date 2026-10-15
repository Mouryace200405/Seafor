import Icon from "./Icon";

function short(model: string): string {
  const i = model.indexOf("/");
  return i >= 0 ? model.slice(i + 1) : model;
}

function catIcon(cat: string): string {
  if (cat === "coder") return "code";
  if (cat === "reasoning") return "brain";
  if (cat === "rag" || cat === "multimodal") return "file";
  return "sparkles";
}

export default function RoutingPanel({ data }: { data: any }) {
  if (!data) return null;
  const cat = data.category || "general";
  const label = data.label || cat;
  const submode = data.submode || "llm";
  const probs: Record<string, number> | null = data.probabilities || null;
  const maxP = probs ? Math.max(1e-6, ...Object.values(probs)) : 1;

  return (
    <div className="voting-panel routing-panel">
      <div className="voting-head">
        <span className="badge purple">
          <Icon name="sparkles" size={11} /> EFT routing
        </span>
        <span className="badge" title="Routing sub-mode">
          {submode === "decision" ? "system-1 decision" : "LLM router"}
        </span>
        <span className="badge green" title="Selected lane">
          <Icon name={catIcon(cat)} size={11} /> {label}
        </span>
        <span className="badge" title="Model answering this turn">
          → {short(data.model || "")}
        </span>
        <span className="badge" style={{ opacity: 0.7 }} title="Router / decision model">
          router: {short(data.router_model || "")}
        </span>
        {typeof data.confidence === "number" ? (
          <span className="badge" title="Confidence">
            {data.confidence.toFixed(3)}
          </span>
        ) : null}
        {data.parsed === false ? <span className="badge red">fallback</span> : null}
      </div>

      {probs ? (
        <div className="voting-tally">
          {Object.entries(probs)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <div className="voting-bar-row" key={k}>
                <span className="voting-bar-name" title={k}>
                  {k}
                </span>
                <span className="voting-bar-track">
                  <span
                    className="voting-bar-fill"
                    style={{ width: `${(v / maxP) * 100}%` }}
                  />
                </span>
                <span className="voting-bar-count">{(v * 100).toFixed(1)}%</span>
              </div>
            ))}
        </div>
      ) : (
        <div className="routing-note">
          <span className="routing-cat" title="Lane">
            {cat}
          </span>
          <span className="voting-rid">{data.model}</span>
        </div>
      )}

      {data.raw ? (
        <details className="routing-details">
          <summary>Router raw output</summary>
          <pre>{data.raw}</pre>
        </details>
      ) : null}
    </div>
  );
}

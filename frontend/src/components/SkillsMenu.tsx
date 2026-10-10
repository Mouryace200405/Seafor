import { useState } from "react";
import { useChat } from "../lib/store";
import { useOutsideClick } from "../lib/useOutsideClick";
import Icon from "./Icon";

export default function SkillsMenu() {
  const { skills, activeThread, toggleSkill } = useChat();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setOpen(false));
  const enabled = new Set(activeThread?.enabled_skills || []);

  return (
    <div className="popover" ref={ref}>
      <button className="btn" onClick={() => setOpen((o) => !o)}>
        <Icon name="sparkles" size={14} />
        Skills
        <span className="badge orange">{enabled.size}</span>
      </button>
      {open && (
        <div className="dropdown" style={{ width: 340 }}>
          <div className="dropdown-list" style={{ padding: 6 }}>
            {skills.map((s) => {
              const on = enabled.has(s.name);
              return (
                <div
                  key={s.name}
                  className={`check-item ${on ? "on" : ""}`}
                  onClick={() => toggleSkill(s.name)}
                >
                  <div className="box">{on ? <Icon name="check" size={12} /> : null}</div>
                  <div>
                    <div style={{ color: "var(--text-strong)", fontSize: 13 }}>
                      {s.name}
                      {s.builtin ? <span className="badge" style={{ marginLeft: 8 }}>builtin</span> : null}
                    </div>
                    <div className="desc">{s.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

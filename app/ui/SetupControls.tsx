"use client";
import { useId } from "react";
import { Icon, type IconName } from "./Icon";
import st from "./setup.module.css";

export function SetupProgress({ labels, step, onBack }: {
  labels: string[]; step: number; onBack?: (step: number) => void;
}) {
  return <ol className={st.steps} aria-label="Этапы заполнения">
    {labels.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined} data-completed={index < step}>
      <button type="button" disabled={!onBack || index >= step} onClick={() => onBack?.(index)}>
        <span>{index < step ? <Icon name="check" size={14} /> : index + 1}</span>
        {label}
      </button>
    </li>)}
  </ol>;
}

export function ChoiceCard({ name, value, selected, title, description, icon, onChange }: {
  name: string; value: string; selected: boolean; title: string; description?: string;
  icon?: IconName; onChange: (value: string) => void;
}) {
  const id = useId();
  return <label className={st.choice} htmlFor={id} data-selected={selected}>
    <input id={id} type="radio" name={name} value={value} checked={selected} onChange={() => onChange(value)} />
    {icon && <span className={st.choiceIcon}><Icon name={icon} size={22} /></span>}
    <span className={st.choiceCopy}><strong>{title}</strong>{description && <small>{description}</small>}</span>
    <span className={st.indicator} aria-hidden="true">{selected && <Icon name="check" size={13} />}</span>
  </label>;
}

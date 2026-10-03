"use client";

interface RangeProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  onScrubStart?: () => void;
  disabled?: boolean;
  valueText?: string;
}

/** Thin custom slider: native input for semantics and keyboard, drawn track and fill. */
export function Range({ id, label, min, max, step = 1, value, onChange, onScrubStart, disabled, valueText }: RangeProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="range" data-disabled={disabled ? "" : undefined}>
      <div className="range-track" aria-hidden>
        <div className="range-fill" style={{ width: `${pct}%` }} />
      </div>
      <input
        id={id}
        type="range"
        aria-label={label}
        aria-valuetext={valueText}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onPointerDown={onScrubStart}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

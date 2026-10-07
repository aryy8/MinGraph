"use client";

import { useRef, type KeyboardEvent } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (v: T) => void;
  id?: string;
}

/** Radio-group style segmented control with arrow-key navigation. */
export function Segmented<T extends string>({ label, value, options, onChange, id }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, dir: number) => {
    const n = options.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + dir * k + n) % n;
      if (!options[i].disabled) {
        onChange(options[i].value);
        refs.current[i]?.focus();
        return;
      }
    }
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(i, 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(i, -1);
    }
  };

  return (
    <div className="segmented" role="radiogroup" aria-label={label} id={id} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={opt.disabled}
            title={opt.title}
            className="segment"
            id={id ? `${id}-${opt.value}` : undefined}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {active ? (
              <svg
                className="segment-check"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : null}
            <span className="segment-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

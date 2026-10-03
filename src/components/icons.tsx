// Simple geometric icons, drawn on a 12x12 grid.

export function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      <path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      <rect x="2.5" y="1.5" width="2.5" height="9" fill="currentColor" />
      <rect x="7" y="1.5" width="2.5" height="9" fill="currentColor" />
    </svg>
  );
}

export function RestartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      <rect x="1.5" y="1.5" width="1.6" height="9" fill="currentColor" />
      <path d="M10.5 1.5 L3.8 6 L10.5 10.5 Z" fill="currentColor" />
    </svg>
  );
}

export function SwapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden focusable="false">
      <path d="M3.5 1.5 V10.5 M1.5 3.5 L3.5 1.5 L5.5 3.5 M8.5 10.5 V1.5 M6.5 8.5 L8.5 10.5 L10.5 8.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden focusable="false">
      <path d="M2 2 L8 8 M8 2 L2 8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

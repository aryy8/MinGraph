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

/**
 * MinGraph Brand Mark (from official design specification):
 * 5 graph node vertices in Google colors forming the "M" network:
 * - Top-Left: Blue (#4285F4)
 * - Top-Right: Red (#EA4335)
 * - Center: Yellow (#FBBC04)
 * - Bottom-Left: Green (#34A853)
 * - Bottom-Right: Blue (#4285F4)
 * Connected by 6 light-blue graph edges (#B8D3FB).
 */
export function MinGraphLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="MinGraph Logo"
    >
      {/* 6 Network edges */}
      {/* Left vertical edge: Top-Left to Bottom-Left */}
      <line x1="24" y1="24" x2="24" y2="76" stroke="#B8D3FB" strokeWidth="6" strokeLinecap="round" />
      {/* Right vertical edge: Top-Right to Bottom-Right */}
      <line x1="76" y1="24" x2="76" y2="76" stroke="#B8D3FB" strokeWidth="6" strokeLinecap="round" />
      {/* Top diagonal left: Top-Left to Center */}
      <line x1="24" y1="24" x2="50" y2="50" stroke="#B8D3FB" strokeWidth="6" strokeLinecap="round" />
      {/* Top diagonal right: Center to Top-Right */}
      <line x1="50" y1="50" x2="76" y2="24" stroke="#B8D3FB" strokeWidth="6" strokeLinecap="round" />
      {/* Bottom diagonal left: Bottom-Left to Center */}
      <line x1="24" y1="76" x2="50" y2="50" stroke="#B8D3FB" strokeWidth="6" strokeLinecap="round" />
      {/* Bottom diagonal right: Center to Bottom-Right */}
      <line x1="50" y1="50" x2="76" y2="76" stroke="#B8D3FB" strokeWidth="6" strokeLinecap="round" />

      {/* 5 Graph Nodes in Google Colors */}
      {/* Top-Left: Google Blue */}
      <circle cx="24" cy="24" r="11" fill="#4285F4" />
      {/* Top-Right: Google Red */}
      <circle cx="76" cy="24" r="11" fill="#EA4335" />
      {/* Center: Google Yellow */}
      <circle cx="50" cy="50" r="11" fill="#FBBC04" />
      {/* Bottom-Left: Google Green */}
      <circle cx="24" cy="76" r="11" fill="#34A853" />
      {/* Bottom-Right: Google Blue */}
      <circle cx="76" cy="76" r="11" fill="#4285F4" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function DirectionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.71 11.29l-9-9a.996.996 0 00-1.41 0l-9 9a.996.996 0 000 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 000-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
    </svg>
  );
}

export function AlgorithmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function ModeCompareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm-5 16V5h5v14H5zm14-16h-5v2h5v14h-5v2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
    </svg>
  );
}

export function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function StatsChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    </svg>
  );
}


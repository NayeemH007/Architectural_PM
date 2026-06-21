/** ArchIntel product mark — a 2x2 project board grid (project control). */
export function ArchIntelMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <rect x="12" y="12" width="33" height="33" rx="6" />
      <rect x="55" y="12" width="33" height="33" rx="6" opacity="0.6" />
      <rect x="12" y="55" width="33" height="33" rx="6" opacity="0.6" />
      <rect x="55" y="55" width="33" height="33" rx="6" />
    </svg>
  );
}

/** SPACE ESSE mark — two stacked frames with center breaks, reproduced
 *  as crisp vector so it scales and recolors (uses currentColor). */
export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={8}
      strokeLinecap="square"
      aria-hidden="true"
    >
      {/* sides */}
      <line x1="14" y1="10" x2="14" y2="90" />
      <line x1="86" y1="10" x2="86" y2="90" />
      {/* middle divider */}
      <line x1="14" y1="50" x2="86" y2="50" />
      {/* top edge with center break */}
      <line x1="14" y1="10" x2="44" y2="10" />
      <line x1="56" y1="10" x2="86" y2="10" />
      {/* bottom edge with center break */}
      <line x1="14" y1="90" x2="44" y2="90" />
      <line x1="56" y1="90" x2="86" y2="90" />
    </svg>
  );
}

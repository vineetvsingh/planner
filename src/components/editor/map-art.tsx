/** A simplified Lisbon: the Tagus, the south bank, Monsanto park and the airport. */
export function MapArt() {
  return (
    <g>
      <rect width="100" height="100" fill="var(--map-land)" />
      {/* Monsanto forest park */}
      <path
        d="M14 40 C 18 30 30 28 36 34 S 40 52 32 58 S 16 60 14 52 Z"
        fill="var(--map-park)"
      />
      {/* Airport and runway */}
      <rect x="71" y="5" width="16" height="13" rx="1.5" fill="var(--map-detail)" opacity="0.6" />
      <path d="M72.5 15.5 L85.5 7.5" stroke="var(--map-land)" strokeWidth="1.2" strokeLinecap="round" />
      {/* Main avenues, for texture */}
      <path
        d="M57 66 C 56 52 60 40 66 26 S 72 14 76 12 M46 62 C 38 50 40 40 44 30 M20 74 C 30 70 40 70 52 64"
        fill="none"
        stroke="var(--map-detail)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* The Tagus */}
      <path
        d="M0 82 C 6 81 10 80 16 79 S 28 78 36 77.5 S 50 74 56 72.5 S 66 70 72 66 S 84 54 90 46 S 97 38 100 36 L100 100 L0 100 Z"
        fill="var(--map-water)"
      />
      {/* South bank (Almada) */}
      <path d="M0 100 L0 89 C 18 87 34 89 50 88 S 74 85 100 80 L100 100 Z" fill="var(--map-land)" />
      {/* 25 de Abril Bridge */}
      <path
        d="M29 77 L31 88.5"
        stroke="var(--muted-foreground)"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        vectorEffect="non-scaling-stroke"
        opacity="0.6"
      />
      <g fill="var(--muted-foreground)" fontSize="2.2" opacity="0.75" style={{ letterSpacing: "0.04em" }}>
        <text x="22" y="45">Monsanto</text>
        <text x="74" y="22">Airport</text>
        <text x="4" y="70">Belém</text>
        <text x="40" y="83" fontStyle="italic">Tagus River</text>
      </g>
    </g>
  )
}

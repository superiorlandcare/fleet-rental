/**
 * SVG fallback art shown until real photos are uploaded — carried over from
 * the prototype, retinted to Rapid Blue, plus trailer/attachment variants
 * so any catalog item gets a clean placeholder.
 */

const ACCENT = "#1ba0e2";
const TRACKS = "#3f3f46";
const ROLLER = "#71717a";
const GLASS = "#18181b";
const SCOOP = "#27272a";

export type ArtKind = "machine-mini" | "machine-cab" | "trailer" | "addon";

export function artKind(opts: { categoryName: string; subtitle: string | null; sortOrder: number }): ArtKind {
  const cat = opts.categoryName.toLowerCase();
  if (cat.includes("trailer")) return "trailer";
  if (cat.includes("machine")) {
    const sub = (opts.subtitle ?? "").toLowerCase();
    if (sub.includes("mini")) return "machine-mini";
    if (sub.includes("compact") || sub.includes("cab")) return "machine-cab";
    return opts.sortOrder % 2 === 1 ? "machine-mini" : "machine-cab";
  }
  return "addon";
}

export function ItemArt({ kind, mini = false }: { kind: ArtKind; mini?: boolean }) {
  const common = {
    width: "100%",
    height: "100%",
    viewBox: "0 0 280 180",
    xmlns: "http://www.w3.org/2000/svg",
    className: mini ? "p-1.5" : "p-6",
  };

  if (kind === "machine-mini") {
    return (
      <svg {...common}>
        <path d="M66 134 H206 a16 16 0 0 1 0 32 H66 a16 16 0 0 1 0 -32 Z" fill={TRACKS} />
        {[80, 110, 140, 170, 196].map((cx) => (
          <circle key={cx} cx={cx} cy="150" r="5" fill={ROLLER} />
        ))}
        <rect x="80" y="104" width="110" height="34" rx="6" fill={ACCENT} />
        <rect x="186" y="68" width="14" height="42" rx="3" fill={ACCENT} />
        <path d="M196 68 v-12" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
        <path d="M150 102 C116 92 86 102 60 124" stroke={ACCENT} strokeWidth="11" fill="none" strokeLinecap="round" />
        <path d="M70 116 H44 a6 6 0 0 0 -6 6 l4 24 a4 4 0 0 0 4 3 H64 Z" fill={SCOOP} stroke={ACCENT} strokeWidth="2" />
      </svg>
    );
  }

  if (kind === "machine-cab") {
    return (
      <svg {...common}>
        <path d="M58 132 H212 a18 18 0 0 1 0 36 H58 a18 18 0 0 1 0 -36 Z" fill={TRACKS} />
        {[72, 104, 135, 166, 198].map((cx) => (
          <circle key={cx} cx={cx} cy="150" r="6" fill={ROLLER} />
        ))}
        <rect x="74" y="98" width="132" height="40" rx="6" fill={ACCENT} />
        <rect x="150" y="56" width="60" height="46" rx="6" fill={ACCENT} />
        <rect x="158" y="64" width="38" height="28" rx="3" fill={GLASS} />
        <path d="M150 96 C112 84 78 96 50 122" stroke={ACCENT} strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d="M60 112 H32 a6 6 0 0 0 -6 6 l4 26 a4 4 0 0 0 4 3 H54 Z" fill={SCOOP} stroke={ACCENT} strokeWidth="2" />
      </svg>
    );
  }

  if (kind === "trailer") {
    return (
      <svg {...common}>
        {/* deck */}
        <rect x="34" y="108" width="190" height="14" rx="4" fill={ACCENT} />
        {/* rails */}
        <path d="M40 108 v-22 M222 108 v-22 M40 90 h182" stroke={ACCENT} strokeWidth="5" strokeLinecap="round" fill="none" />
        {/* gooseneck / tongue */}
        <path d="M224 112 q26 0 30 -26 v-10" stroke={ACCENT} strokeWidth="7" fill="none" strokeLinecap="round" />
        {/* axles */}
        <circle cx="86" cy="138" r="14" fill={TRACKS} />
        <circle cx="86" cy="138" r="6" fill={ROLLER} />
        <circle cx="126" cy="138" r="14" fill={TRACKS} />
        <circle cx="126" cy="138" r="6" fill={ROLLER} />
        {/* jack */}
        <path d="M236 122 v22" stroke={TRACKS} strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  // generic add-on plate
  return (
    <svg {...common}>
      <rect x="96" y="52" width="88" height="76" rx="8" fill="none" stroke={ACCENT} strokeWidth="6" />
      <path d="M118 76 h44 M118 96 h44" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" />
      <circle cx="140" cy="140" r="8" fill={ROLLER} />
    </svg>
  );
}

/** Small line icons for attachment cards without photos, keyed off the name. */
export function AttachmentIcon({ name }: { name: string }) {
  const p = {
    width: 46,
    height: 46,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const n = name.toLowerCase();
  if (n.includes("bucket"))
    return (
      <svg {...p}>
        <path d="M11 17h26l-4 17a3 3 0 0 1-3 2H18a3 3 0 0 1-3-2z" />
        <path d="M11 17l-3-6" />
      </svg>
    );
  if (n.includes("fork"))
    return (
      <svg {...p}>
        <path d="M12 9v30M24 9v30M9 16h21" />
      </svg>
    );
  if (n.includes("grapple"))
    return (
      <svg {...p}>
        <path d="M24 8v9" />
        <path d="M14 17h20" />
        <path d="M14 17c-3 13 5 18 10 19M34 17c3 13-5 18-10 19" />
      </svg>
    );
  if (n.includes("backhoe"))
    return (
      <svg {...p}>
        <path d="M8 38h14" />
        <path d="M12 38l8-16 14-8" />
        <path d="M34 14l6 10-5 8" />
        <path d="M35 32l-7 2 3 6z" />
      </svg>
    );
  if (n.includes("auger"))
    return (
      <svg {...p}>
        <path d="M24 7v30" />
        <path d="M16 12l16 4M16 20l16 4M16 28l16 4" />
        <path d="M21 41h6" />
      </svg>
    );
  // generic quick-attach plate
  return (
    <svg {...p}>
      <rect x="12" y="10" width="24" height="28" rx="3" />
      <path d="M18 18h12M18 26h12" />
    </svg>
  );
}

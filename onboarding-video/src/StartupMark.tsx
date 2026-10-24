import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
export function StartupMark({ quiet = false }: { quiet?: boolean }) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig(),
    t = quiet ? 4 : frame / fps;
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const p = (from: number, to: number) =>
    interpolate(t, [from, to], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });
  const trace = p(0.1, 1.3),
    identity = p(0.75, 1.65),
    settle = p(0.1, 1.55),
    sweep = p(0.8, 2.1);
  return (
    <svg
      direction="ltr"
      viewBox="0 0 520 230"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="startup-halo">
          <stop stopColor="#477caf" stopOpacity=".16" />
          <stop offset="1" stopColor="#477caf" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="startup-metal" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#eaf5ff" />
          <stop offset=".45" stopColor="#80a4cb" />
          <stop offset="1" stopColor="#edf5ff" />
        </linearGradient>
        <linearGradient id="startup-line">
          <stop stopColor="#42739d" stopOpacity="0" />
          <stop offset=".5" stopColor="#b2cff0" />
          <stop offset="1" stopColor="#42739d" stopOpacity="0" />
        </linearGradient>
        <clipPath id="startup-shield-clip">
          <path d="M130 65 163 78v29c0 23-14 39-33 49-19-10-33-26-33-49V78z" />
        </clipPath>
      </defs>
      <ellipse
        cx="130"
        cy="110"
        rx="145"
        ry="115"
        fill="url(#startup-halo)"
        opacity={settle}
      />
      <g
        transform={`translate(${(1 - settle) * 14} ${(1 - settle) * 8})`}
        opacity={trace}
      >
        <circle
          cx="130"
          cy="110"
          r="78"
          fill="none"
          stroke="#33475f"
          strokeWidth=".7"
          strokeDasharray="490"
          strokeDashoffset={490 * (1 - trace)}
          transform={`rotate(${-130 + (1 - settle) * 45} 130 110)`}
        />
        <path
          d="M52 110a78 78 0 0 1 78-78"
          fill="none"
          stroke="#a9c8e7"
          strokeWidth="1.2"
          strokeDasharray="123"
          strokeDashoffset={123 * (1 - trace)}
          opacity={0.75}
        />
        <path
          d="M130 65 163 78v29c0 23-14 39-33 49-19-10-33-26-33-49V78z"
          fill="#101923"
          stroke="url(#startup-metal)"
          strokeWidth="1.5"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - trace}
        />
        <g clipPath="url(#startup-shield-clip)">
          <rect
            x={65 + sweep * 130}
            y="54"
            width="15"
            height="115"
            fill="#c9dfff"
            opacity={quiet ? 0 : Math.sin(sweep * Math.PI) * 0.12}
            transform={`rotate(-20 ${130} 110)`}
          />
        </g>
        <path
          d="m116 109 10 10 20-22"
          fill="none"
          stroke="#c3daf0"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="43"
          strokeDashoffset={43 * (1 - p(0.8, 1.55))}
        />
      </g>
      <g opacity={identity} transform={`translate(${(1 - identity) * 20} 0)`}>
        <text
          x="237"
          y="128"
          fill="#edf3fb"
          fontFamily="Arial,sans-serif"
          fontWeight="600"
          fontSize="63"
          letterSpacing="3"
        >
          Zunis
        </text>
        <path
          d="M238 148h165"
          stroke="url(#startup-line)"
          strokeWidth=".7"
          opacity={p(1.1, 2)}
        />
        <text
          x="240"
          y="170"
          fill="#72869f"
          fontFamily="Arial,sans-serif"
          fontSize="9"
          letterSpacing="4"
        >
          EXAM INTEGRITY
        </text>
      </g>
    </svg>
  );
}
export function StartupPreview() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "#080b10",
      }}
    >
      <div style={{ width: 760 }}>
        <StartupMark />
      </div>
    </div>
  );
}

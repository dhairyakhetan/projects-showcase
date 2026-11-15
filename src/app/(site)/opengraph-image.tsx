import { ImageResponse } from "next/og";
import { OG_SIZE, ogFont } from "@/lib/og";

export const alt = "Dhairya Khetan — Class 11, preparing for JEE, building things in between";
export const size = OG_SIZE;
export const contentType = "image/png";

const C = {
  bg: "#0b0c0a",
  panel: "#0f110d",
  panelHi: "#121410",
  rule: "#23261f",
  line: "#2c3027",
  ink: "#ebe8df",
  dim: "#9fa294",
  faint: "#6f7268",
  accent: "#c8f55a",
  dot: "#262a20",
};

const TABS = [
  ["Home", ".js"],
  ["About", ".md"],
  ["Qualification", ".json"],
  ["Projects", "/"],
  ["Contact", ".sh"],
];

/**
 * The home page's ferrofluid, flattened for a PNG: a star of spikes whose
 * lengths wobble, lit from the upper left, with a rim of the accent. Built as
 * an SVG string because the OG renderer can't run the real shader.
 */
function ferrofluidSvg() {
  const spikes = 46;
  const cx = 200;
  const cy = 200;
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    // Taller on the upper right, where the "magnet" is.
    const lean = Math.max(0, Math.cos(angle + Math.PI / 4));
    const wobble = 0.82 + 0.18 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
    const radius = i % 2 === 0 ? (128 + 62 * lean) * wobble : 112;
    points.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<radialGradient id="body" cx="0.36" cy="0.32" r="0.75">
<stop offset="0" stop-color="#565b4c"/><stop offset="0.4" stop-color="#1a1d16"/><stop offset="1" stop-color="#070806"/>
</radialGradient>
<radialGradient id="gloss" cx="0.36" cy="0.3" r="0.12">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
</radialGradient>
</defs>
<ellipse cx="200" cy="372" rx="120" ry="16" fill="${C.accent}" fill-opacity="0.08"/>
<polygon points="${points.join(" ")}" fill="url(#body)" stroke="${C.accent}" stroke-opacity="0.9" stroke-width="2" stroke-linejoin="miter"/>
<circle cx="200" cy="200" r="112" fill="url(#gloss)"/>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The site's link preview: the editor chrome, the name, and the ferrofluid. */
export default async function Image() {
  const [serif, serifItalic, mono] = await Promise.all([
    ogFont("InstrumentSerif-Regular.ttf"),
    ogFont("InstrumentSerif-Italic.ttf"),
    ogFont("MartianMono-Regular.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: C.bg,
          backgroundImage: `radial-gradient(circle at 14px 14px, ${C.dot} 1.4px, transparent 1.6px)`,
          backgroundSize: "28px 28px",
          color: C.ink,
          fontFamily: "Martian Mono",
        }}
      >
        {/* tabs */}
        <div style={{ display: "flex", height: 60, borderBottom: `1px solid ${C.rule}`, backgroundColor: C.bg }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0 28px", fontSize: 20 }}>
            dk<span style={{ color: C.accent }}>_</span>
          </div>
          {TABS.map(([tab, tag], i) => (
            <div
              key={tab}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 20px",
                fontSize: 14,
                borderLeft: `1px solid ${C.rule}`,
                borderTop: `2px solid ${i === 0 ? C.accent : "transparent"}`,
                backgroundColor: i === 0 ? C.panelHi : "transparent",
                color: i === 0 ? C.ink : C.dim,
              }}
            >
              <span style={{ fontSize: 11, color: i === 0 ? C.accent : C.faint }}>0{i + 1}</span>
              <span style={{ display: "flex" }}>
                {tab}
                <span style={{ color: C.faint }}>{tag}</span>
              </span>
            </div>
          ))}
        </div>

        {/* body */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 18, color: C.dim }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, marginRight: 12, backgroundColor: C.accent }} />
              hello, world — i'm
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 18,
                fontFamily: "Instrument Serif",
                fontSize: 150,
                lineHeight: 0.86,
                letterSpacing: "-0.03em",
              }}
            >
              <span>Dhairya</span>
              <span style={{ display: "flex", fontStyle: "italic" }}>
                Khetan<span style={{ color: C.accent, fontStyle: "normal" }}>.</span>
              </span>
            </div>
            <div style={{ display: "flex", marginTop: 30, fontSize: 22 }}>
              I build&nbsp;<span style={{ color: C.accent }}>websites</span>
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element -- the OG renderer takes plain <img> */}
          <img src={ferrofluidSvg()} width={400} height={400} alt="" />
        </div>

        {/* status bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 38,
            padding: "0 22px",
            borderTop: `1px solid ${C.rule}`,
            backgroundColor: C.panel,
            fontSize: 13,
            color: C.dim,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, backgroundColor: C.accent }} />
              open to collabs
            </span>
            <span>class 11 · jee prep</span>
          </div>
          <span style={{ color: C.ink }}>dhairyakhetan.vercel.app</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
        { name: "Instrument Serif", data: serifItalic, style: "italic", weight: 400 },
        { name: "Martian Mono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}

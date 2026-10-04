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

const TABS = ["home.js", "about.md", "qualification.json", "projects/", "contact.sh"];

/** The site's link preview: the editor, the name, and a terminal that says what's here. */
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
          {TABS.map((tab, i) => (
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
              {tab}
            </div>
          ))}
        </div>

        {/* body */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 64px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 18, color: C.dim }}>
              <span style={{ color: C.accent, marginRight: 12 }}>//</span>hello, world — i'm
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
              <span style={{ width: 11, height: 26, marginLeft: 4, backgroundColor: C.accent }} />
            </div>
          </div>

          {/* terminal */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 380,
              border: `1px solid ${C.line}`,
              backgroundColor: C.panel,
              boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 38,
                padding: "0 16px",
                borderBottom: `1px solid ${C.rule}`,
                fontSize: 12,
                color: C.dim,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: C.line }} />
                ))}
              </div>
              ~/dhairya — zsh
              <span style={{ width: 39 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "20px 18px", fontSize: 14, lineHeight: 1.5 }}>
              <span style={{ display: "flex" }}>
                <span style={{ color: C.accent, marginRight: 10 }}>$</span>whoami
              </span>
              <span style={{ color: C.dim }}>class 11, india. codes after homework.</span>
              <span style={{ display: "flex" }}>
                <span style={{ color: C.accent, marginRight: 10 }}>$</span>ls projects/
              </span>
              <span style={{ color: C.dim }}>terranotes  japan2026</span>
              <span style={{ display: "flex" }}>
                <span style={{ color: C.accent, marginRight: 10 }}>$</span>
                <span style={{ width: 9, height: 18, backgroundColor: C.accent }} />
              </span>
            </div>
          </div>
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

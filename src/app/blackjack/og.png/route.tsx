import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { OG_SIZE, ogFont } from "@/lib/og";

// /blackjack sits outside the portfolio's layout, so its link preview is a
// route of its own, built once at build time in the same editor look.
export const dynamic = "force-static";

const C = {
  bg: "#0b0c0a",
  panel: "#0f110d",
  rule: "#23261f",
  ink: "#ebe8df",
  dim: "#9fa294",
  faint: "#6f7268",
  accent: "#c8f55a",
  dot: "#262a20",
};

export async function GET() {
  const [serif, serifItalic, mono, table] = await Promise.all([
    ogFont("InstrumentSerif-Regular.ttf"),
    ogFont("InstrumentSerif-Italic.ttf"),
    ogFont("MartianMono-Regular.ttf"),
    readFile(path.join(process.cwd(), "src/app/blackjack/table.jpg")),
  ]);
  const shot = `data:image/jpeg;base64,${table.toString("base64")}`;

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
        <div style={{ display: "flex", alignItems: "center", height: 60, borderBottom: `1px solid ${C.rule}`, padding: "0 28px", fontSize: 20 }}>
          dk<span style={{ color: C.accent }}>_</span>
          <span style={{ marginLeft: 22, fontSize: 14, color: C.dim }}>Blackjack.py</span>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 18, color: C.dim }}>
              <span style={{ width: 9, height: 9, borderRadius: 9, marginRight: 12, backgroundColor: C.accent }} />
              play money · written in python
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 18,
                fontFamily: "Instrument Serif",
                fontSize: 128,
                lineHeight: 0.88,
                letterSpacing: "-0.03em",
              }}
            >
              <span>Black</span>
              <span style={{ display: "flex", fontStyle: "italic" }}>
                jack<span style={{ color: C.accent, fontStyle: "normal" }}>.</span>
              </span>
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 20, color: C.dim }}>
              runs right in your browser
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element -- the OG renderer takes plain <img> */}
          <img
            src={shot}
            width={640}
            height={360}
            alt=""
            style={{ border: `2px solid ${C.accent}`, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
          />
        </div>

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
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, backgroundColor: C.accent }} />
            $1,000 to start · no real money, ever
          </span>
          <span style={{ color: C.ink }}>dhairyakhetan.vercel.app/blackjack</span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
        { name: "Instrument Serif", data: serifItalic, style: "italic", weight: 400 },
        { name: "Martian Mono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}

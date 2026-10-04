import { ImageResponse } from "next/og";
import { DAYS, type City } from "@/japan/data";
import { OG_SIZE, ogFont } from "@/lib/og";

export const alt = "Japan trip · 19–28 October 2026 · Tokyo, Kyoto, Osaka";
export const size = OG_SIZE;
export const contentType = "image/png";

const INK = "#1c1f24";
const MUTED = "#5e6570";
const LINE = "#dcdfe3";
const COLOR: Record<City, string> = { tokyo: "#2b4c7e", kyoto: "#4f6f45", osaka: "#b07a12", travel: "#7a7f87" };
const NAME: Record<City, string> = { tokyo: "Tokyo", kyoto: "Kyoto", osaka: "Osaka", travel: "Flight" };

/** Consecutive days in one city, for the coloured bar across the top. */
const SEGMENTS = DAYS.reduce<{ city: City; span: number }[]>((acc, day) => {
  const last = acc[acc.length - 1];
  if (last && last.city === day.city) last.span++;
  else acc.push({ city: day.city, span: 1 });
  return acc;
}, []);

const weekday = (date: string) =>
  new Date(`${date}T00:00:00+09:00`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Tokyo" });

/**
 * The planner's own look: the date strip from its header. Dates and cities
 * only — no names, hotels or flights in a picture that gets shared around.
 */
export default async function Image() {
  const [serif, sans] = await Promise.all([
    ogFont("ShipporiMincho-ExtraBold.ttf"),
    ogFont("ZenKakuGothicNew-Bold.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 64px",
          backgroundColor: "#f6f7f5",
          color: INK,
          fontFamily: "Zen Kaku Gothic New",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, letterSpacing: "0.22em", color: MUTED }}>19 – 28 OCTOBER 2026</span>
            <span style={{ marginTop: 6, fontFamily: "Shippori Mincho", fontSize: 140, lineHeight: 1, letterSpacing: "-0.02em" }}>
              Japan
            </span>
            <span style={{ marginTop: 10, fontSize: 28, color: MUTED }}>Ten days · Tokyo, Kyoto, Osaka</span>
          </div>
          {/* the hinomaru from the planner's favicon */}
          <div style={{ display: "flex", marginBottom: 18, width: 120, height: 120, borderRadius: 120, backgroundColor: "#b3392f" }} />
        </div>

        {/* city bar */}
        <div style={{ display: "flex", gap: 12, marginTop: 44 }}>
          {SEGMENTS.map((segment, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", flexGrow: segment.span, flexBasis: 0 }}>
              <div style={{ height: 8, borderRadius: 8, backgroundColor: COLOR[segment.city] }} />
              <span style={{ marginTop: 8, fontFamily: "Shippori Mincho", fontSize: 22, color: COLOR[segment.city] }}>
                {NAME[segment.city]}
              </span>
            </div>
          ))}
        </div>

        {/* day chips */}
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          {DAYS.map(day => (
            <div
              key={day.date}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                flexBasis: 0,
                padding: "12px 14px",
                borderRadius: 18,
                border: `1.5px solid ${LINE}`,
                backgroundColor: "#ffffff",
              }}
            >
              <span style={{ fontSize: 14, color: MUTED }}>{weekday(day.date).toUpperCase()}</span>
              <span style={{ fontFamily: "Shippori Mincho", fontSize: 40, lineHeight: 1.1, color: COLOR[day.city] }}>
                {Number(day.date.slice(8, 10))}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Shippori Mincho", data: serif, style: "normal", weight: 800 },
        { name: "Zen Kaku Gothic New", data: sans, style: "normal", weight: 700 },
      ],
    },
  );
}

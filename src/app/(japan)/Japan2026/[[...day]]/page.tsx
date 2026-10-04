import JapanTrip from "@/japan/JapanTrip";
import { DAYS } from "@/japan/data";

/** /Japan2026 and /Japan2026/day1 … /day10 — the planner reads which from the URL. */
export function generateStaticParams() {
  return [{ day: [] }, ...DAYS.map((_, i) => ({ day: [`day${i + 1}`] }))];
}

export const dynamicParams = false;

export default function JapanPage() {
  return <JapanTrip />;
}

import JapanTrip from "@/japan/JapanTrip";
import { DAYS } from "@/japan/data";

/** /Japan2026, /Japan2026/day1 … /day10 and /Japan2026/countdown — the planner reads which from the URL. */
export function generateStaticParams() {
  return [{ day: [] }, ...DAYS.map((_, i) => ({ day: [`day${i + 1}`] })), { day: ["countdown"] }];
}

export const dynamicParams = false;

export default function JapanPage() {
  return <JapanTrip />;
}

"use client";

import dynamic from "next/dynamic";

/**
 * Client-only on purpose. The planner reads the date ("3 days to go", which
 * day is today), the URL and the screen width while it renders; on the server
 * that would freeze at build time and then disagree with the browser.
 */
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <div className="min-h-dvh bg-paper" />,
});

export default function JapanTrip() {
  return <App />;
}

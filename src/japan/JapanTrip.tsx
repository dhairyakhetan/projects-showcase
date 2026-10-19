"use client";

import { useSyncExternalStore } from "react";
import App from "./App";

const noop = () => () => {};

/**
 * Client-only on purpose. The planner reads the date ("3 days to go", which
 * day is today), the URL and the screen width while it renders; on the server
 * that would freeze at build time and then disagree with the browser. So the
 * server sends an empty page and the planner draws on the first client render.
 *
 * Imported directly rather than with next/dynamic: a dynamic chunk is only
 * requested after React has started, an extra round trip on hotel Wi-Fi or
 * roaming; this way its code downloads alongside the rest of the page.
 */
export default function JapanTrip() {
  const client = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return client ? <App /> : <div className="min-h-dvh bg-paper" />;
}

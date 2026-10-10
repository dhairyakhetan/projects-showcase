import { Instrument_Serif, Martian_Mono } from "next/font/google";

/* Statements in the serif, everything else in the mono. */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian-mono",
  display: "swap",
});

/**
 * Goes on <html>, not <body>: --font-mono is declared on :root in
 * globals.css, and a variable it references must exist there too.
 */
export const fontVariables = `${instrumentSerif.variable} ${martianMono.variable}`;

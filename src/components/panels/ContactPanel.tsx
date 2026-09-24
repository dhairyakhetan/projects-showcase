"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import ArrowUpRight from "@/components/ArrowUpRight";
import { Reveal } from "@/components/Reveal";
import Variant from "@/components/Variant";
import { contact } from "@/lib/content";

/**
 * Hands the message to the visitor's own mail app rather than pretending to
 * deliver it. There's no backend here, and a form that prints "delivered"
 * without sending anything is worse than no form — so the success state says
 * exactly what happened: a draft was opened, and they still have to hit send.
 */
function Composer() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState(false);
  const [opened, setOpened] = useState(false);

  function send(event?: FormEvent) {
    event?.preventDefault();

    if (!name.trim() || !message.trim()) {
      setMissing(true);
      return;
    }

    const subject = encodeURIComponent(`Hi from ${name.trim()}`);
    const body = encodeURIComponent(message.trim());
    window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;
    setOpened(true);
  }

  // ⌘/Ctrl+Enter sends from the message box, like most chat inputs.
  function onMessageKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
  }

  const field =
    "w-full border border-line bg-bg px-3.5 text-[13px] text-ink outline-none transition-colors focus:border-dim";

  return (
    <div className="panel">
      <div className="panel-bar">
        <Variant dev="./send_message.sh" plain="send me a message" />
        <Variant dev={<span>{opened ? "exit 0" : "ready"}</span>} plain={null} />
      </div>

      {opened ? (
        <div role="status" className="panel-enter flex flex-col gap-3.5 px-7 py-10 text-[13px] leading-[1.8]">
          <Variant
            block
            dev={
              <>
                <p className="text-dim">$ ./send_message.sh --name &quot;{name.trim()}&quot;</p>
                <p>
                  packing message<span className="text-accent"> ........ done</span>
                </p>
                <p>
                  opening your mail app<span className="text-accent"> .. done</span>
                </p>
              </>
            }
            plain={<p className="text-dim">Your email app should have opened with the message ready to go.</p>}
          />
          <p className="mt-3 font-display text-[clamp(2rem,5vw,2.75rem)] leading-[1.05]">
            Thanks, {name.trim()}. <span className="italic text-accent">Hit send there.</span>
          </p>
          <p className="text-xs text-dim">
            Nothing opened? Write to{" "}
            <a href={`mailto:${contact.email}`} className="text-ink underline underline-offset-4">
              {contact.email}
            </a>{" "}
            directly.
          </p>
          <button
            type="button"
            onClick={() => setOpened(false)}
            data-cursor-label="edit"
            className="btn btn-ghost mt-2 h-[42px] self-start px-[18px] text-xs"
          >
            edit message
          </button>
        </div>
      ) : (
        <form onSubmit={send} noValidate className="flex flex-col gap-5 p-7">
          <div className="flex flex-col gap-2">
            <label htmlFor="f-name" className="text-[11px] text-dim">
              <Variant
                dev={
                  <>
                    <span className="text-accent">--</span>name
                  </>
                }
                plain="your name"
              />
            </label>
            <input
              id="f-name"
              value={name}
              onChange={event => {
                setName(event.target.value);
                setMissing(false);
              }}
              autoComplete="name"
              className={`${field} h-[46px]`}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="f-msg" className="text-[11px] text-dim">
              <Variant
                dev={
                  <>
                    <span className="text-accent">--</span>message
                  </>
                }
                plain="message"
              />
            </label>
            <textarea
              id="f-msg"
              value={message}
              onChange={event => {
                setMessage(event.target.value);
                setMissing(false);
              }}
              onKeyDown={onMessageKey}
              rows={5}
              className={`${field} resize-none py-3 leading-[1.7]`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <span role="status" className="text-[11px] text-err">
              {missing ? (
                <Variant
                  dev="error: --name and --message are required"
                  plain="Add your name and a message first."
                />
              ) : null}
            </span>
            <button type="submit" data-cursor-label="send" className="btn btn-primary h-[50px]">
              <Variant dev="run send" plain="send" /> <span aria-hidden>↵</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function ContactPanel() {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Blocked clipboard — the address is on screen in full anyway.
    }
  }

  const row =
    "row-link flex justify-between border-b border-rule px-3 py-[18px] text-left text-[13px]";

  return (
    <section
      aria-label="Contact"
      className="grid min-h-[calc(100svh-var(--header-h)-var(--status-h)-7rem)] items-center gap-14 xl:grid-cols-[minmax(0,1fr)_560px] xl:gap-20"
    >
      <div className="flex flex-col gap-8">
        <Reveal>
          <p className="text-xs text-dim">
            <span className="text-accent">05</span> / <Variant dev="contact.sh" plain="Contact" />
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h2 className="font-display text-[clamp(4rem,14vw,7.5rem)] font-normal leading-[0.9] tracking-[-0.03em]">
            Let&apos;s <span className="italic text-accent">talk.</span>
          </h2>
        </Reveal>

        <Reveal delay={140}>
          <p className="max-w-[480px] text-sm leading-[1.8] text-dim">{contact.intro}</p>
        </Reveal>

        <Reveal delay={200}>
          {/* Each row says what the platform is for. The handle is my name on
              every one of them, which the page already establishes. */}
          <ul className="max-w-[560px] border-t border-rule">
            <li>
              <button
                type="button"
                onClick={copyEmail}
                data-cursor-label={copied ? "copied" : "copy"}
                className={`${row} w-full items-center gap-6`}
              >
                <span className="shrink-0 text-dim">email</span>
                <span className="min-w-0 truncate text-xs">
                  {copied ? <span className="text-accent">copied ✓</span> : contact.email}
                </span>
              </button>
            </li>
            {contact.links.map(link => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor-label="open"
                  className={`${row} flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-6`}
                >
                  <span className="shrink-0 text-dim">{link.label}</span>
                  <span className="flex min-w-0 items-center gap-2 text-xs sm:text-right">
                    <span className="min-w-0">{link.note}</span>
                    <ArrowUpRight className="nudge shrink-0 text-dim" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={220} y={24}>
        <Composer />
      </Reveal>
    </section>
  );
}

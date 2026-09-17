"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import type { CaptureErrorBody } from "@/app/api/capture/route";
import type { CaptureResult, EnrichmentStatus } from "@/lib/engine/capture";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; message: string } | { kind: "error"; message: string };

interface Outcome {
  saved: boolean;
  status: Status;
}

const UNCONFIRMED: Outcome = {
  saved: false,
  status: { kind: "error", message: "Couldn't confirm this capture. Your text is still here; copy it, then reload to see whether it was saved." },
};

/** What the response says about the capture. Enrichment gaps never read as a failed capture. */
function savedMessage(enrichment: EnrichmentStatus | undefined): string {
  const notes = ["Captured."];
  if (!enrichment) return notes[0];
  if (enrichment.extraction === "failed") notes.push("Its title and concepts couldn't be extracted right now.");
  if (enrichment.houses === "fallback") notes.push("Its houses couldn't be classified, so neutral defaults were used.");
  if (enrichment.houses === "failed") notes.push("Its houses couldn't be classified right now.");
  if (enrichment.relations === "failed" || enrichment.relations === "skipped") notes.push("Related thoughts couldn't be suggested right now.");
  return notes.join(" ");
}

async function send(text: string): Promise<Outcome> {
  try {
    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) {
      return { saved: true, status: { kind: "saved", message: savedMessage((body as CaptureResult | null)?.enrichment) } };
    }
    const err = body as Partial<CaptureErrorBody> | null;
    if (err?.saved === true) {
      return { saved: true, status: { kind: "saved", message: "Captured, but its details couldn't be loaded." } };
    }
    if (err?.error === "capture_not_saved") {
      return { saved: false, status: { kind: "error", message: "Couldn't save this thought. Your text is still here." } };
    }
    if (err?.error === "invalid_request" || err?.error === "unsupported_media_type" || err?.error === "forbidden") {
      return { saved: false, status: { kind: "error", message: "This thought couldn't be captured. Nothing was saved." } };
    }
    return UNCONFIRMED;
  } catch {
    return UNCONFIRMED;
  }
}

/**
 * Single multiline capture field (SPEC.md §25B). Cmd/Ctrl + Enter captures. The field clears only after the
 * server confirms the thought is stored; while a capture is running, the field is read-only and further
 * submits are ignored.
 */
export function CaptureBox() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const inFlight = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const saving = status.kind === "saving";

  async function capture() {
    const text = input.current?.value ?? content;
    if (inFlight.current || text.trim() === "") return;
    inFlight.current = true;
    setStatus({ kind: "saving" });
    const outcome = await send(text);

    // Render the result before releasing the guard, so a keypress that arrives next sees the cleared field.
    flushSync(() => {
      setStatus(outcome.status);
      if (outcome.saved) setContent((current) => (current === text ? "" : current));
    });
    inFlight.current = false;

    // Refresh only after a confirmed save. A refresh that cannot reach the server makes Next reload the
    // page, which would discard text the user still needs.
    if (outcome.saved) router.refresh();

    // Return focus only if it was in the capture form (or dropped to the page when the button was disabled).
    const active = document.activeElement;
    if (active === null || active === document.body || form.current?.contains(active)) {
      input.current?.focus({ preventScroll: true });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void capture();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!event.repeat) void capture();
    }
  }

  return (
    <form ref={form} className="capture" aria-label="Capture" onSubmit={onSubmit} aria-busy={saving}>
      <label htmlFor="capture" className="capture__label">
        What are you thinking?
      </label>
      <textarea
        id="capture"
        ref={input}
        className="capture__input"
        placeholder="What are you thinking?"
        value={content}
        readOnly={saving}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="capture__footer">
        <p className="capture__hint">Cmd/Ctrl + Enter to capture</p>
        <button type="submit" className="capture__button" disabled={saving}>
          Capture
        </button>
      </div>
      <p className={status.kind === "error" ? "capture__status capture__status--error" : "capture__status"} role="status">
        {status.kind === "saving" ? "Capturing…" : status.kind === "idle" ? "" : status.message}
      </p>
    </form>
  );
}

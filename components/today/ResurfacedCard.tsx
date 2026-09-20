"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CognitiveObject } from "@/lib/domain/types";

export interface ResurfacedThought {
  object: CognitiveObject;
  why: string;
  ageDays: number;
}

function age(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }
  if (days >= 60) return `${Math.floor(days / 30)} months ago`;
  if (days >= 14) return `${Math.floor(days / 7)} weeks ago`;
  if (days <= 1) return "yesterday";
  return `${days} days ago`;
}

const EXCERPT_CHARS = 220;

/**
 * SPEC.md §25E — at most one returned thought: RETURN, title, short excerpt, age, why it returned.
 * Open focuses it, Useful and Dismiss record feedback. None of them change the thought itself.
 */
export function ResurfacedCard({ resurfaced, href }: { resurfaced: ResurfacedThought; href: string }) {
  const router = useRouter();
  const { object, why, ageDays } = resurfaced;
  const [recorded, setRecorded] = useState<"useful" | "dismissed" | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = useRef<HTMLAnchorElement>(null);

  async function record(action: "useful" | "opened" | "dismissed") {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "object", targetId: object.id, action }),
      });
      // Only a confirmed write changes what the card says; otherwise the card would claim something the
      // store does not hold, and the thought would come back tomorrow as if nothing had happened.
      if (!res.ok) {
        if (action !== "opened") setFailed(true);
        return;
      }
      if (action !== "opened") setRecorded(action);
      // Useful disables the two buttons and Dismiss removes the card, so keyboard focus would fall to the
      // page: hand it to the Open link, or to the capture field once the card is gone (SPEC §37).
      if (action === "useful") open.current?.focus({ preventScroll: true });
      if (action === "dismissed") {
        document.getElementById("capture")?.focus({ preventScroll: true });
        router.refresh();
      }
    } catch {
      if (action !== "opened") setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (recorded === "dismissed") return null;

  const excerpt = object.content.length > EXCERPT_CHARS ? `${object.content.slice(0, EXCERPT_CHARS)}…` : object.content;
  return (
    <section className="return" aria-labelledby="return-heading">
      <h2 id="return-heading" className="return__label">
        Return
      </h2>
      <article className="return__card">
        {object.title && <h3 className="return__title">{object.title}</h3>}
        <p className="return__excerpt">{excerpt}</p>
        <p className="return__meta">
          <span>{age(ageDays)}</span>
          <span className="return__why">Why this returned: {why}</span>
        </p>
        <p className="return__actions">
          <Link ref={open} className="return__open" href={href} onClick={() => void record("opened")}>
            Open
          </Link>
          <button type="button" className="return__button" onClick={() => void record("useful")} disabled={busy || recorded !== null}>
            Useful
          </button>
          <button type="button" className="return__button" onClick={() => void record("dismissed")} disabled={busy || recorded !== null}>
            Dismiss
          </button>
          {recorded === "useful" && (
            <span role="status" className="return__recorded">
              Thanks — recorded.
            </span>
          )}
          {failed && (
            <span role="status" className="return__recorded">
              Couldn&apos;t record that.
            </span>
          )}
        </p>
      </article>
    </section>
  );
}

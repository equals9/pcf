"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Claim, CognitiveObject, ContradictionClass, ContradictionResult } from "@/lib/domain/types";

export interface TensionView {
  result: ContradictionResult;
  claimA: Claim;
  claimB: Claim;
  objectA: CognitiveObject;
  objectB: CognitiveObject;
}

/** §24 classifications, in the user's words. The classifier never says which claim is right. */
const CLASSIFICATION_LABELS: Record<ContradictionClass, string> = {
  true_contradiction: "These cannot both hold",
  partial_tension: "These pull against each other",
  scope_difference: "These apply to different scopes",
  temporal_change: "Your position changed over time",
  supersession: "The later one replaces the earlier",
  none: "No tension",
};

function captured(object: CognitiveObject): string {
  return new Date(object.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/**
 * SPEC.md §25F — at most one unresolved tension: both claims, the classification and a short explanation.
 * Exactly two actions: "Open both" shows the two thoughts the claims were extracted from, unedited, and
 * "Not a conflict" records the user's judgement. Neither changes a claim, a thought, or decides which one
 * is correct.
 */
export function TensionCard({ tension }: { tension: TensionView }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { result, claimA, claimB, objectA, objectB } = tension;

  async function dismiss() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "contradiction", claimAId: claimA.id, claimBId: claimB.id }),
      });
      if (res.ok) {
        setDismissed(true);
        // The card disappears with the focused button in it; the capture field takes focus (SPEC §37).
        document.getElementById("capture")?.focus({ preventScroll: true });
        router.refresh();
      }
    } catch {
      // The tension stays on screen; nothing canonical changed.
    } finally {
      setBusy(false);
    }
  }

  if (dismissed) return null;

  return (
    <section className="tension" aria-labelledby="tension-heading">
      <h2 id="tension-heading" className="tension__label">
        Tension
      </h2>
      <article className="tension__card">
        <p className="tension__classification">{CLASSIFICATION_LABELS[result.classification]}</p>
        <ol className="tension__claims">
          <li>
            <span className="tension__side">Claim A</span> {claimA.normalizedClaim}
          </li>
          <li>
            <span className="tension__side">Claim B</span> {claimB.normalizedClaim}
          </li>
        </ol>
        <p className="tension__explanation">{result.explanation}</p>
        {result.unresolvedQuestion && <p className="tension__question">Still to settle: {result.unresolvedQuestion}</p>}
        <p className="tension__actions">
          <button type="button" className="tension__open" onClick={() => setOpen((was) => !was)} aria-expanded={open}>
            Open both
          </button>
          <button type="button" className="tension__button" onClick={() => void dismiss()} disabled={busy}>
            Not a conflict
          </button>
        </p>
        {open && (
          <div className="tension__sources">
            {[
              { side: "Claim A", object: objectA },
              { side: "Claim B", object: objectB },
            ].map(({ side, object }) => (
              <article key={object.id} className="tension__source">
                <h3 className="tension__source-title">
                  {side} · {object.title ?? "Untitled"} · {captured(object)}
                </h3>
                <p className="tension__source-content">{object.content}</p>
              </article>
            ))}
          </div>
        )}
        <p className="tension__note">
          Claim A and Claim B are how the extraction phrased each thought. The thoughts themselves are unchanged.
        </p>
      </article>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { OperatorResult, type OperatorRunResult } from "./OperatorResult";
import type { CognitiveOperator } from "@/lib/domain/types";

/** SPEC §25D: exactly these four, and no other AI action. §38 fixes the operation state wording. */
const OPERATORS: Array<{ operator: CognitiveOperator; symbol: string; name: string; running: string }> = [
  { operator: "mercury_connect", symbol: "☿", name: "Connect", running: "Connecting…" },
  { operator: "jupiter_expand", symbol: "♃", name: "Expand", running: "Expanding…" },
  { operator: "saturn_challenge", symbol: "♄", name: "Challenge", running: "Challenging…" },
  { operator: "mars_act", symbol: "♂", name: "Act", running: "Designing experiment…" },
];

const FAILED = "Couldn't complete this operation. Your thought is safe.";

/**
 * The four cognitive operators for one thought (SPEC §25C, §25D). Results appear inline beneath the thought.
 * Invoking an operator is a fetch, never a navigation, so the capture draft and the constellation focus stay
 * exactly as they were.
 */
export function OperatorBar({ objectId }: { objectId: string }) {
  const [running, setRunning] = useState<CognitiveOperator | null>(null);
  const [run, setRun] = useState<OperatorRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function invoke(operator: CognitiveOperator) {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(operator);
    setError(null);
    try {
      const res = await fetch(`/api/object/${encodeURIComponent(objectId)}/operator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (res.ok && body) {
        setRun(body as OperatorRunResult);
      } else {
        const message = (body as { error?: string; message?: string } | null)?.error === "not_classified"
          ? "This thought has no house classification yet, so there is nothing to reason over."
          : FAILED;
        setError(message);
      }
    } catch {
      setError(FAILED);
    } finally {
      inFlight.current = false;
      setRunning(null);
    }
  }

  const busy = running !== null;
  return (
    <div className="operators">
      <div className="operators__bar" role="group" aria-label="Cognitive operators">
        {OPERATORS.map(({ operator, symbol, name }) => (
          <button
            key={operator}
            type="button"
            className={running === operator ? "operators__button operators__button--active" : "operators__button"}
            onClick={() => void invoke(operator)}
            disabled={busy}
            aria-busy={running === operator}
          >
            <span aria-hidden="true">{symbol}</span> {name}
          </button>
        ))}
      </div>
      <p className="operators__state" role="status">
        {running ? OPERATORS.find((o) => o.operator === running)?.running : error}
      </p>
      {/* Keyed by run: a new result must never inherit the previous result's feedback state. */}
      {run && <OperatorResult key={run.runId} run={run} />}
    </div>
  );
}

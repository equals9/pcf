"use client";

import { useState } from "react";
import type { CognitiveOperator } from "@/lib/domain/types";

/** The four §23 result shapes, as returned by the operator route. */
interface Connection {
  targetId: string;
  relationType: string;
  explanation: string;
  whyNonObvious: string;
  confidence: number;
}
interface Possibility {
  title: string;
  hypothesis: string;
  groundedInObjectIds: string[];
  bridgeExplanation: string;
  whyNovel: string;
  nextQuestion: string;
}
interface Challenge {
  coreAssumptions: string[];
  strongestObjection: string;
  failureModes: string[];
  missingEvidence: string[];
  alternativeInterpretation: string | null;
  confidenceAssessment: { currentEstimate: number; rationale: string };
}
interface Act {
  experimentTitle: string;
  hypothesis: string;
  smallestAction: string;
  steps: string[];
  successCriterion: string;
  failureCriterion: string;
  evidenceToCapture: string[];
}

export interface OperatorRunResult {
  runId: string;
  operator: CognitiveOperator;
  result: Record<string, unknown>;
  /** The packet's objects, so cited ids can be shown as thoughts rather than raw ids. */
  objects: Array<{ id: string; title: string }>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="operator__section">
      <h5 className="operator__section-title">{title}</h5>
      {children}
    </div>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="operator__list">
    {items.map((item, index) => (
      <li key={index}>{item}</li>
    ))}
  </ul>
);

/** Names the objects an operator cites. */
type TitleLookup = (id: string) => string;

function Body({ operator, result, titleOf }: { operator: CognitiveOperator; result: Record<string, unknown>; titleOf: TitleLookup }) {
  switch (operator) {
    case "mercury_connect": {
      const connections = (result.connections ?? []) as Connection[];
      if (connections.length === 0) return <p className="operator__empty">No grounded connection found.</p>;
      return (
        <ol className="operator__items">
          {connections.map((c, index) => (
            <li key={index}>
              <p className="operator__lead">
                {c.relationType.replace(/_/g, " ")} · {titleOf(c.targetId)}
              </p>
              <p>{c.explanation}</p>
              <p className="operator__aside">Why it is not obvious: {c.whyNonObvious}</p>
              <p className="operator__aside">Suggested only — nothing was added to your graph. Confidence {c.confidence.toFixed(2)}.</p>
            </li>
          ))}
        </ol>
      );
    }
    case "jupiter_expand": {
      const possibilities = (result.possibilities ?? []) as Possibility[];
      if (possibilities.length === 0) return <p className="operator__empty">No adjacent possibility found.</p>;
      return (
        <ol className="operator__items">
          {possibilities.map((p, index) => (
            <li key={index}>
              <p className="operator__lead">{p.title}</p>
              <p>
                <span className="operator__tag">Possibility</span> {p.hypothesis}
              </p>
              <p className="operator__aside">Built from: {p.groundedInObjectIds.map(titleOf).join("; ")}</p>
              <p className="operator__aside">{p.bridgeExplanation}</p>
              <p className="operator__aside">Why it is new: {p.whyNovel}</p>
              <p className="operator__aside">Next question: {p.nextQuestion}</p>
            </li>
          ))}
        </ol>
      );
    }
    case "saturn_challenge": {
      const c = result as unknown as Challenge;
      return (
        <>
          <Section title="Strongest objection">
            <p>{c.strongestObjection}</p>
          </Section>
          {c.coreAssumptions.length > 0 && (
            <Section title="Assumptions this rests on">
              <List items={c.coreAssumptions} />
            </Section>
          )}
          {c.failureModes.length > 0 && (
            <Section title="How it could fail">
              <List items={c.failureModes} />
            </Section>
          )}
          {c.missingEvidence.length > 0 && (
            <Section title="Evidence that would settle it">
              <List items={c.missingEvidence} />
            </Section>
          )}
          {c.alternativeInterpretation && (
            <Section title="Another reading">
              <p>{c.alternativeInterpretation}</p>
            </Section>
          )}
          <p className="operator__aside">
            Claude&apos;s confidence that the thought holds: {c.confidenceAssessment.currentEstimate.toFixed(2)}. {c.confidenceAssessment.rationale} Your
            belief is unchanged; nothing was rewritten.
          </p>
        </>
      );
    }
    case "mars_act": {
      const a = result as unknown as Act;
      return (
        <>
          <p className="operator__lead">{a.experimentTitle}</p>
          <Section title="Smallest action">
            <p>{a.smallestAction}</p>
          </Section>
          <Section title="Hypothesis">
            <p>{a.hypothesis}</p>
          </Section>
          {a.steps.length > 0 && (
            <Section title="Steps">
              <ol className="operator__list">
                {a.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </Section>
          )}
          <Section title="Decide in advance">
            <p>Success: {a.successCriterion}</p>
            <p>Failure: {a.failureCriterion}</p>
          </Section>
          {a.evidenceToCapture.length > 0 && (
            <Section title="Evidence to capture">
              <List items={a.evidenceToCapture} />
            </Section>
          )}
          <p className="operator__aside">A proposal. Nothing runs on its own.</p>
        </>
      );
    }
  }
}

/** Feedback on the result (SPEC §26, §39). It is recorded beside the result and never changes it. */
function Feedback({ runId }: { runId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function send(action: "useful" | "not_useful") {
    if (state === "sending" || state === "done") return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "operator_run", targetId: runId, action }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <p className="operator__feedback" role="status">Thanks — recorded.</p>;
  return (
    <p className="operator__feedback">
      <span className="operator__feedback-label">Was this useful?</span>
      <button type="button" className="operator__feedback-button" onClick={() => void send("useful")} disabled={state === "sending"}>
        Useful
      </button>
      <button type="button" className="operator__feedback-button" onClick={() => void send("not_useful")} disabled={state === "sending"}>
        Not useful
      </button>
      {state === "error" && <span role="status">Couldn&apos;t record that.</span>}
    </p>
  );
}

const OPERATOR_NAMES: Record<CognitiveOperator, string> = {
  mercury_connect: "☿ Connect",
  jupiter_expand: "♃ Expand",
  saturn_challenge: "♄ Challenge",
  mars_act: "♂ Act",
};

/** One operator result, inline beneath the thought it was run on (SPEC §25D). */
export function OperatorResult({ run }: { run: OperatorRunResult }) {
  const titles = new Map(run.objects.map((o) => [o.id, o.title]));
  const titleOf: TitleLookup = (id) => titles.get(id) ?? id;
  return (
    <article className="operator" aria-label={`${OPERATOR_NAMES[run.operator]} result`}>
      <h4 className="operator__title">{OPERATOR_NAMES[run.operator]}</h4>
      <Body operator={run.operator} result={run.result} titleOf={titleOf} />
      <Feedback runId={run.runId} />
    </article>
  );
}

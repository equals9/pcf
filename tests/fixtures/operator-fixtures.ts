import type { PcfDatabase } from "../../lib/db/database";
import { getObject } from "../../lib/db/repositories/objects";
import type { OperatorDeps, OperatorLogEntry } from "../../lib/engine/operator-runner";
import { buildRetrievalPacket } from "../../lib/engine/operator-runner";
import { MockReasoner } from "./mock-reasoner";
import { steppingClock } from "./capture-fixtures";

// Deterministic §23 operator results. No private data, and no real Claude.

export function connectResult(targetId: string) {
  return {
    connections: [
      {
        targetId,
        relationType: "related_to",
        explanation: "Both thoughts turn on where memory is kept.",
        whyNonObvious: "They use different vocabulary for the same tension.",
        confidence: 0.7,
      },
    ],
  };
}

export function expandResult(groundedInObjectIds: string[]) {
  return {
    possibilities: [
      {
        title: "Editable memory as a product surface",
        hypothesis: "A person may value memory they can edit more than memory that is merely accurate.",
        groundedInObjectIds,
        bridgeExplanation: "The cited thoughts both treat inspectability as the point of external memory.",
        whyNovel: "It reframes accuracy as secondary to control.",
        nextQuestion: "What would a person edit first?",
      },
    ],
  };
}

export const CHALLENGE_RESULT = {
  coreAssumptions: ["Memory outside weights stays inspectable in practice."],
  strongestObjection: "Inspectability is worthless if nobody ever inspects it.",
  failureModes: ["The store grows faster than anyone can review."],
  missingEvidence: ["Whether the user ever edits stored memory."],
  alternativeInterpretation: "The value may be in deletion rather than inspection.",
  confidenceAssessment: { currentEstimate: 0.55, rationale: "The packet shows intent but no usage evidence." },
};

export const ACT_RESULT = {
  experimentTitle: "One week of editing logged memory",
  hypothesis: "If memory is worth inspecting, it will be edited at least once a week.",
  smallestAction: "Open the stored memory once a day and record whether anything needed changing.",
  steps: ["Open the store each evening.", "Note any entry that is wrong.", "Edit or leave it."],
  successCriterion: "At least one meaningful edit in seven days.",
  failureCriterion: "No edits and no wish to edit.",
  evidenceToCapture: ["Count of edits", "What prompted each edit"],
};

/** A MockReasoner that answers each operator task with a schema-valid result for the given anchor's packet. */
export function operatorMock(db: PcfDatabase, anchorId: string): MockReasoner {
  const built = buildRetrievalPacket(db, anchorId);
  const relatedId = built.ok ? built.packet.relatedObjects[0]?.id : undefined;
  const focusId = getObject(db, anchorId)?.id ?? anchorId;
  return new MockReasoner({
    responses: {
      "mercury-connect": relatedId ? connectResult(relatedId) : { connections: [] },
      "jupiter-expand": expandResult([focusId]),
      "saturn-challenge": CHALLENGE_RESULT,
      "mars-act": ACT_RESULT,
    },
  });
}

export function operatorDeps(db: PcfDatabase, reasoner: MockReasoner, logs: OperatorLogEntry[] = []): OperatorDeps {
  return { db, reasoner, now: steppingClock(), log: (entry) => logs.push(entry) };
}

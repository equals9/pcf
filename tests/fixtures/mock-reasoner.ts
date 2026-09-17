import type { Reasoner, ReasonerHealth, RunStructuredInput } from "../../lib/ai/reasoner";
import { ReasonerError } from "../../lib/ai/reasoner";
import { validateStructured } from "../../lib/ai/structured-output";

// SPEC.md §30 — deterministic mock Reasoner. Automated tests never consume Claude subscription usage.

export type MockResponseFn = (input: RunStructuredInput<unknown>) => unknown;
export type MockResponse = MockResponseFn | Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface MockReasonerOptions {
  /** Canned response per task name. A function receives the call input. */
  responses?: Record<string, MockResponse>;
  /** When true, every call fails as if Claude were unavailable. */
  unavailable?: boolean;
}

export interface MockCall {
  task: string;
  system: string;
  prompt: string;
}

export class MockReasoner implements Reasoner {
  readonly calls: MockCall[] = [];
  private readonly responses: Record<string, MockResponse>;
  unavailable: boolean;

  constructor(options: MockReasonerOptions = {}) {
    this.responses = { ...(options.responses ?? {}) };
    this.unavailable = options.unavailable ?? false;
  }

  setResponse(task: string, response: MockResponse): void {
    this.responses[task] = response;
  }

  async healthCheck(): Promise<ReasonerHealth> {
    return this.unavailable
      ? { available: false, provider: "mock", version: null, error: "mock reasoner marked unavailable" }
      : { available: true, provider: "mock", version: "mock", error: null };
  }

  async runStructured<T>(input: RunStructuredInput<T>): Promise<T> {
    this.calls.push({ task: input.task, system: input.system, prompt: input.prompt });
    if (this.unavailable) {
      throw new ReasonerError("unavailable", input.task, "mock reasoner marked unavailable");
    }
    if (!(input.task in this.responses)) {
      throw new ReasonerError("unavailable", input.task, `mock reasoner has no response for task "${input.task}"`);
    }
    const response = this.responses[input.task];
    const raw = typeof response === "function" ? response(input as RunStructuredInput<unknown>) : response;
    const validated = validateStructured(input.schema, structuredClone(raw));
    if (!validated.ok) {
      throw new ReasonerError("invalid_output", input.task, "mock response failed schema validation", { issues: validated.issues });
    }
    return validated.value;
  }
}

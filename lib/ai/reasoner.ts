import type { z } from "zod";

// SPEC.md §16 — Claude is a replaceable reasoning provider, never application memory.

export interface ReasonerHealth {
  available: boolean;
  provider: string;
  version: string | null;
  error: string | null;
}

export interface RunStructuredInput<T> {
  /** Short operation name, e.g. "extract". Used for logs; never contains user content. */
  task: string;
  /** Fixed instruction text. It is passed on the claude command line, so it must never contain user content. */
  system: string;
  /** User content and retrieved context. Sent on stdin only. */
  prompt: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
}

export interface Reasoner {
  healthCheck(): Promise<ReasonerHealth>;
  runStructured<T>(input: RunStructuredInput<T>): Promise<T>;
}

/**
 * - unavailable: the provider could not run or reported an error (not retried)
 * - timeout: the call exceeded its timeout (not retried)
 * - invalid_output: output failed schema validation after the single allowed retry
 */
export type ReasonerErrorKind = "unavailable" | "timeout" | "invalid_output";

export class ReasonerError extends Error {
  readonly kind: ReasonerErrorKind;
  readonly task: string;
  readonly details: Record<string, unknown>;

  constructor(kind: ReasonerErrorKind, task: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ReasonerError";
    this.kind = kind;
    this.task = task;
    this.details = details;
  }
}

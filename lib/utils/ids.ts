import { randomUUID } from "node:crypto";

/** Stable, opaque CognitiveObject/record identifier. Never derived from title or position. */
export function newId(): string {
  return randomUUID();
}

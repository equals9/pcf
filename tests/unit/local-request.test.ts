import { describe, expect, it } from "vitest";
import { isLoopbackRequest } from "../../lib/utils/local-request";

const headers = (values: Record<string, string>) => new Headers(values);

describe("isLoopbackRequest", () => {
  it.each(["localhost", "localhost:3000", "LOCALHOST:3000", "127.0.0.1:3000", "[::1]:3000"])("accepts host %s", (host) => {
    expect(isLoopbackRequest(headers({ host }))).toBe(true);
  });

  it.each([
    "rebind.attacker.example:3000",
    "localhost.attacker.example",
    "localhost.",
    "localhost@attacker.example",
    "attacker.example/@localhost",
    "127.0.0.2:3000",
    "0.0.0.0:3000",
    "192.168.1.23:3000",
    "",
  ])("refuses host %s", (host) => {
    expect(isLoopbackRequest(headers({ host }))).toBe(false);
  });

  it("refuses a request without a host", () => {
    expect(isLoopbackRequest(headers({}))).toBe(false);
  });

  it("accepts a loopback origin and refuses any other", () => {
    expect(isLoopbackRequest(headers({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
    expect(isLoopbackRequest(headers({ host: "localhost:3000", origin: "http://127.0.0.1:5173" }))).toBe(true);
    expect(isLoopbackRequest(headers({ host: "localhost:3000", origin: "https://attacker.example" }))).toBe(false);
    expect(isLoopbackRequest(headers({ host: "localhost:3000", origin: "null" }))).toBe(false);
  });
});

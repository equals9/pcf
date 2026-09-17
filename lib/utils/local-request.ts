// PCF is a local, single-user app (SPEC §5, §27). It answers only requests addressed to this machine by a
// loopback name. A DNS-rebinding page reaches the server under its own host name, so it is refused here even
// though the browser treats its requests as same-origin.

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function loopback(url: string): boolean {
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** True when the Host header is a loopback name and any Origin header is a loopback page. */
export function isLoopbackRequest(headers: { get(name: string): string | null }): boolean {
  const host = headers.get("host");
  if (host === null || !loopback(`http://${host}`)) return false;
  const origin = headers.get("origin");
  return origin === null || loopback(origin);
}

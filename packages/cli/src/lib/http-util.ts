import { timingSafeEqual } from "node:crypto";
import { type IncomingMessage, type ServerResponse } from "node:http";

export function requestPath(req: IncomingMessage): string {
  return new URL(req.url ?? "/", "http://127.0.0.1").pathname;
}

/**
 * Largest request body the daemon will buffer. A 1M-token context at ~4 bytes
 * per token is ~4 MB of text; 64 MB leaves generous room for base64 image
 * blocks on top of the biggest advertised window while still bounding memory.
 * Override with `NEMOCODE_MAX_REQUEST_BYTES` if a future model needs more.
 */
const DEFAULT_MAX_REQUEST_BYTES = 64 * 1024 * 1024;

export class RequestBodyTooLargeError extends Error {
  readonly status = 413;
  constructor(readonly limitBytes: number) {
    super(`Request body exceeds the ${limitBytes}-byte limit.`);
    this.name = "RequestBodyTooLargeError";
  }
}

function maxRequestBytes(): number {
  const raw = process.env.NEMOCODE_MAX_REQUEST_BYTES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_REQUEST_BYTES;
}

/**
 * Read the full request body as JSON, returning both the parsed value and the
 * raw byte length of the inbound body. The byte length is the cheap signal the
 * proxy's self-calibrating token estimator keys on (see cost.ts): the
 * Anthropic-JSON size tracks the translated OpenAI-JSON size within a few
 * percent, so it lets us estimate input tokens without serializing the payload
 * a second time.
 *
 * Buffering is capped. The daemon is loopback-only, so this is not an
 * anti-abuse control - it is a bound on a *bug*: one runaway agent that keeps
 * appending to a conversation would otherwise grow this buffer until the
 * daemon OOMs, taking every other session's proxy down with it. Failing one
 * request with a 413 is strictly better than losing the process.
 */
export async function readJsonBodyWithSize(
  req: IncomingMessage,
): Promise<{ body: unknown; rawBytes: number }> {
  const limit = maxRequestBytes();
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limit) {
      // Stop reading and release what we have; the caller renders the error in
      // its own wire format.
      req.destroy();
      chunks.length = 0;
      throw new RequestBodyTooLargeError(limit);
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks);
  const text = raw.toString("utf8");
  const body = text ? JSON.parse(text) : {};
  return { body, rawBytes: raw.length };
}

/**
 * Backwards-compatible thin wrapper around readJsonBodyWithSize that discards
 * the byte length. Existing callers (codex proxy, daemon server) are unaffected.
 */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return (await readJsonBodyWithSize(req)).body;
}

export function writeJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

/**
 * Pull the presented auth token from a request: the `Bearer` value of the
 * Authorization header, or the `x-api-key` header.
 */
export function extractToken(req: IncomingMessage): string | undefined {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  const apiKey = req.headers["x-api-key"];
  return typeof apiKey === "string" ? apiKey : undefined;
}

export function isAuthorized(req: IncomingMessage, authToken: string): boolean {
  const token = extractToken(req);
  return token !== undefined && constantTimeEqual(token, authToken);
}

export function constantTimeEqual(actual: string | undefined, expected: string): boolean {
  if (typeof actual !== "string") {
    return false;
  }
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }
  return timingSafeEqual(actualBytes, expectedBytes);
}

import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export function ownerSecret() {
  const secret = process.env.SMPL_OWNER_SECRET;
  if (!secret) throw new Error("SMPL_OWNER_SECRET is not configured.");
  return secret;
}

export function origin(request: Request) {
  const configured = process.env.SMPL_PUBLIC_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

import { createHash } from "crypto";
import { ACCESS_TTL, TokenRecord, authenticateClient, issueTokens } from "@/lib/oauth";
import { getJson, redis } from "@/lib/redis";
import { json, safeEqual } from "@/lib/security";

export const runtime = "nodejs";

type CodeRecord = {
  clientId: string;
  redirect: string;
  redirectExplicit: boolean;
  scopes: string[];
  resource: string;
  codeChallenge: string;
};

export async function POST(request: Request) {
  const raw = await request.text();
  const form = new URLSearchParams(raw);
  let client;
  try {
    client = await authenticateClient(request, form);
  } catch (error) {
    return json({ error: "invalid_client", error_description: String(error) }, 401);
  }

  const grant = form.get("grant_type");
  if (grant === "authorization_code") {
    const code = form.get("code") || "";
    const record = await getJson<CodeRecord>(`smpl:oauth:code:${code}`);
    if (!record || record.clientId !== client.client_id) return json({ error: "invalid_grant" }, 400);

    const sentRedirect = form.get("redirect_uri");
    const expectedRedirect = record.redirectExplicit ? record.redirect : null;
    if (sentRedirect !== expectedRedirect) {
      return json({ error: "invalid_grant", error_description: "redirect_uri did not match authorization request" }, 400);
    }

    const verifier = form.get("code_verifier") || "";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    if (!record.codeChallenge || !safeEqual(challenge, record.codeChallenge)) {
      return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
    }

    await redis(["DEL", `smpl:oauth:code:${code}`]);
    const { access, refresh } = await issueTokens(client.client_id, record.scopes, record.resource);
    return json({
      access_token: access,
      token_type: "Bearer",
      expires_in: ACCESS_TTL,
      refresh_token: refresh,
      scope: record.scopes.join(" "),
    });
  }

  if (grant === "refresh_token") {
    const old = form.get("refresh_token") || "";
    const record = await getJson<TokenRecord>(`smpl:oauth:refresh:${old}`);
    if (!record || record.client_id !== client.client_id || record.expires_at <= Math.floor(Date.now() / 1000)) {
      return json({ error: "invalid_grant" }, 400);
    }
    await redis(["DEL", `smpl:oauth:refresh:${old}`]);
    const { access, refresh } = await issueTokens(client.client_id, record.scopes, record.resource);
    return json({
      access_token: access,
      token_type: "Bearer",
      expires_in: ACCESS_TTL,
      refresh_token: refresh,
      scope: record.scopes.join(" "),
    });
  }

  return json({ error: "unsupported_grant_type" }, 400);
}

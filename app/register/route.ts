import { OAuthClient, SCOPES, redirectAllowed, saveClient } from "@/lib/oauth";
import { json, randomToken } from "@/lib/security";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const redirects = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
    if (!redirects.length || redirects.some((u: string) => !redirectAllowed(u))) {
      return json({ error: "invalid_redirect_uri" }, 400);
    }
    const method = String(body.token_endpoint_auth_method || "client_secret_post");
    if (!["client_secret_post", "client_secret_basic", "none"].includes(method)) {
      return json({ error: "invalid_client_metadata" }, 400);
    }
    const requested = String(body.scope || SCOPES.join(" ")).split(/\s+/).filter(Boolean);
    if (requested.some((s: string) => !SCOPES.includes(s))) {
      return json({ error: "invalid_client_metadata", error_description: "Unsupported scope" }, 400);
    }
    const clientId = randomUUID();
    const clientSecret = method === "none" ? null : randomToken(32);
    const client: OAuthClient = {
      ...body,
      application_type: body.application_type || "native",
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: clientSecret ? 0 : null,
      redirect_uris: redirects,
      response_types: body.response_types || ["code"],
      grant_types: body.grant_types || ["authorization_code", "refresh_token"],
      scope: requested.join(" "),
      token_endpoint_auth_method: method as OAuthClient["token_endpoint_auth_method"],
    };
    await saveClient(client);
    return json(client, 201);
  } catch (error) {
    return json({ error: "invalid_client_metadata", detail: String(error) }, 400);
  }
}

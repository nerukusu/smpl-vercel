import { getClient, resourceUrl } from "@/lib/oauth";
import { setJson } from "@/lib/redis";
import { json, origin, randomToken } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const clientId = q.get("client_id") || "";
  const client = await getClient(clientId);
  if (!client) return json({ error: "invalid_request", error_description: "Client ID not found" }, 400);
  if (q.get("response_type") !== "code") return json({ error: "unsupported_response_type" }, 400);
  if ((q.get("code_challenge_method") || "S256") !== "S256" || !q.get("code_challenge")) {
    return json({ error: "invalid_request", error_description: "PKCE S256 is required" }, 400);
  }

  const redirects = client.redirect_uris || [];
  const explicit = q.has("redirect_uri");
  const redirect = q.get("redirect_uri") || (redirects.length === 1 ? redirects[0] : "");
  if (!redirect || !redirects.includes(redirect)) {
    return json({ error: "invalid_request", error_description: "redirect_uri is not registered" }, 400);
  }

  const allowed = String(client.scope || "mcp offline_access").split(/\s+/);
  const scopes = String(q.get("scope") || client.scope || "mcp offline_access").split(/\s+/).filter(Boolean);
  if (scopes.some((s) => !allowed.includes(s))) return json({ error: "invalid_scope" }, 400);

  const resource = q.get("resource") || resourceUrl(request);
  if (resource !== resourceUrl(request)) return json({ error: "invalid_target" }, 400);

  const id = randomToken(24);
  await setJson(
    `smpl:oauth:pending:${id}`,
    {
      clientId,
      redirect,
      redirectExplicit: explicit,
      state: q.get("state"),
      scopes,
      resource,
      codeChallenge: q.get("code_challenge"),
      createdAt: Date.now(),
    },
    1800,
  );
  return Response.redirect(`${origin(request)}/oauth/approve?id=${encodeURIComponent(id)}`, 302);
}

import { SCOPES } from "@/lib/oauth";
import { json, origin } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const o = origin(request);
  return json(
    {
      issuer: `${o}/`,
      authorization_endpoint: `${o}/authorize`,
      token_endpoint: `${o}/token`,
      registration_endpoint: `${o}/register`,
      scopes_supported: SCOPES,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
      revocation_endpoint: `${o}/revoke`,
      revocation_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
      code_challenge_methods_supported: ["S256"],
    },
    200,
    { "Cache-Control": "public, max-age=3600" },
  );
}

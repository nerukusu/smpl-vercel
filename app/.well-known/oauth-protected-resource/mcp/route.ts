import { SCOPES, resourceUrl } from "@/lib/oauth";
import { json, origin } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return json(
    {
      resource: resourceUrl(request),
      authorization_servers: [`${origin(request)}/`],
      scopes_supported: SCOPES,
      bearer_methods_supported: ["header"],
    },
    200,
    { "Cache-Control": "no-store" },
  );
}

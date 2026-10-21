import { authenticateClient, revokeToken } from "@/lib/oauth";
import { json } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  try {
    await authenticateClient(request, form);
  } catch (error) {
    return json({ error: "invalid_client", error_description: String(error) }, 401);
  }
  const token = form.get("token") || "";
  if (token) await revokeToken(token);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

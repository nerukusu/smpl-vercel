import { registerDevice } from "@/lib/device";
import { json, ownerSecret, safeEqual, sha256 } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supplied = String(body.ownerSecret || "");
    if (!supplied || !safeEqual(supplied, ownerSecret())) return json({ error: "invalid_owner_secret" }, 401);
    const id = String(body.deviceId || "").trim();
    const secret = String(body.deviceSecret || "");
    const name = String(body.name || "Windows PC").slice(0, 120);
    const tools = Array.isArray(body.tools) ? body.tools : [];
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(id) || secret.length < 32 || tools.length === 0) {
      return json({ error: "invalid_device_registration" }, 400);
    }
    await registerDevice({ id, name, secretHash: sha256(secret), tools, registeredAt: Date.now() });
    return json({ ok: true, deviceId: id, name });
  } catch (error) {
    return json({ error: "registration_failed", detail: String(error) }, 500);
  }
}

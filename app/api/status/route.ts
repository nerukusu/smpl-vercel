import { isOnline, registeredDevice } from "@/lib/device";
import { json } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  try {
    const device = await registeredDevice();
    return json({
      ok: true,
      configured: Boolean(process.env.SMPL_OWNER_SECRET && (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)),
      device: device ? { id: device.id, name: device.name, online: await isOnline(device.id), registeredAt: device.registeredAt } : null,
    });
  } catch (error) {
    return json({ ok: false, configured: false, error: String(error) }, 503);
  }
}

import { isOnline, registeredDevice } from "@/lib/device";
import { checkSupabase } from "@/lib/supabase";
import { json } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(
    process.env.SMPL_OWNER_SECRET &&
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
  if (!configured) return json({ ok: false, configured: false, error: "Supabase or owner secret is not configured." }, 503);
  try {
    await checkSupabase();
    const device = await registeredDevice();
    return json({
      ok: true,
      configured: true,
      storage: "supabase",
      device: device ? { id: device.id, name: device.name, online: await isOnline(device.id), registeredAt: device.registeredAt } : null,
    });
  } catch (error) {
    return json({ ok: false, configured: true, storage: "supabase", error: String(error) }, 503);
  }
}

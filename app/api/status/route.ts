import { isOnline, registeredDevice } from "@/lib/device";
import { checkSupabase, listJsonPrefix } from "@/lib/supabase";
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
    const [clients, pending, codes, access, refresh] = await Promise.all([
      listJsonPrefix<unknown>("smpl:oauth:client:"),
      listJsonPrefix<unknown>("smpl:oauth:pending:"),
      listJsonPrefix<unknown>("smpl:oauth:code:"),
      listJsonPrefix<unknown>("smpl:oauth:access:"),
      listJsonPrefix<unknown>("smpl:oauth:refresh:"),
    ]);
    return json({
      ok: true,
      configured: true,
      storage: "supabase",
      device: device ? { id: device.id, name: device.name, online: await isOnline(device.id), registeredAt: device.registeredAt, toolCount: device.tools.length, toolNames: device.tools.map((t) => t.name) } : null,
      oauth: { clients: clients.length, pending: pending.length, codes: codes.length, accessTokens: access.length, refreshTokens: refresh.length },
    });
  } catch (error) {
    return json({ ok: false, configured: true, storage: "supabase", error: String(error) }, 503);
  }
}

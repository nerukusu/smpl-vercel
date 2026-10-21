import { authenticateDevice, touchDevice } from "@/lib/device";
import { claimNextJob } from "@/lib/supabase";
import { json } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const device = await authenticateDevice(request);
    if (!device) return json({ error: "unauthorized_device" }, 401);
    await touchDevice(device.id);
    const job = await claimNextJob(device.id);
    if (!job) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    return json({ jobId: job.id, request: job.request });
  } catch (error) {
    return json({ error: "poll_failed", detail: String(error) }, 500);
  }
}

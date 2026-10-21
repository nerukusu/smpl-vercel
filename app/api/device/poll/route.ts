import { authenticateDevice, dequeue, touchDevice } from "@/lib/device";
import { getJson } from "@/lib/redis";
import { json } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const device = await authenticateDevice(request);
    if (!device) return json({ error: "unauthorized_device" }, 401);
    await touchDevice(device.id);
    for (let i = 0; i < 4; i++) {
      const jobId = await dequeue(device.id);
      if (!jobId) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
      const job = await getJson<{ request: unknown }>(`smpl:job:${jobId}`);
      if (job) return json({ jobId, request: job.request });
    }
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return json({ error: "poll_failed", detail: String(error) }, 500);
  }
}

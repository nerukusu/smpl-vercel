import { authenticateDevice, touchDevice } from "@/lib/device";
import { getJson, setJson } from "@/lib/redis";
import { json } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const device = await authenticateDevice(request);
    if (!device) return json({ error: "unauthorized_device" }, 401);
    await touchDevice(device.id);
    const body = await request.json();
    const jobId = String(body.jobId || "");
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(jobId)) return json({ error: "invalid_job" }, 400);
    const job = await getJson<{ deviceId: string }>(`smpl:job:${jobId}`);
    if (!job || job.deviceId !== device.id) return json({ error: "job_not_found" }, 404);
    await setJson(`smpl:result:${jobId}`, body.response, 90);
    return json({ ok: true });
  } catch (error) {
    return json({ error: "result_failed", detail: String(error) }, 500);
  }
}

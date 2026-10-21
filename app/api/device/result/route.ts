import { authenticateDevice, touchDevice } from "@/lib/device";
import { completeJob, getJob } from "@/lib/supabase";
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
    const job = await getJob(jobId);
    if (!job || job.device_id !== device.id) return json({ error: "job_not_found" }, 404);
    if (!(await completeJob(jobId, device.id, body.response))) return json({ error: "job_not_running" }, 409);
    return json({ ok: true });
  } catch (error) {
    return json({ error: "result_failed", detail: String(error) }, 500);
  }
}

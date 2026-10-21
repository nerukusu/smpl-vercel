import { onlineDevice, registeredDevice } from "@/lib/device";
import { createJob, deleteJob, getJobResult } from "@/lib/supabase";
import { validBearer } from "@/lib/oauth";
import { json, origin, randomToken } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

function rpc(id: unknown, result: unknown) {
  return json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}
function unauthorized(request: Request) {
  const metadata = `${origin(request)}/.well-known/oauth-protected-resource/mcp`;
  return json({ error: "unauthorized" }, 401, {
    "WWW-Authenticate": `Bearer error="invalid_token", error_description="Authentication required", resource_metadata="${metadata}"`,
  });
}

export async function GET(request: Request) {
  if (!(await validBearer(request))) return unauthorized(request);
  return json({ error: "Use POST for MCP JSON-RPC" }, 405);
}

export async function POST(request: Request) {
  if (!(await validBearer(request))) return unauthorized(request);
  let body: any;
  try { body = await request.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  if (Array.isArray(body)) return rpcError(null, -32600, "JSON-RPC batches are not supported");
  const id = body?.id;
  const method = String(body?.method || "");
  const params = body?.params || {};
  if (id === undefined || id === null) return new Response(null, { status: 202 });

  if (method === "initialize") {
    return rpc(id, {
      protocolVersion: params.protocolVersion || "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "smpl-vercel-relay", version: "0.2.0" },
    });
  }
  if (method === "ping") return rpc(id, {});
  if (method === "tools/list") {
    const device = await registeredDevice();
    return rpc(id, { tools: device?.tools || [] });
  }
  if (method !== "tools/call") return rpcError(id, -32601, "Method not found");

  const device = await onlineDevice();
  if (!device) return rpc(id, { content: [{ type: "text", text: "Windows client is offline." }], isError: true });

  const jobId = randomToken(24);
  await createJob(jobId, device.id, body, 90);

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const result = await getJobResult(jobId);
    if (result) {
      await deleteJob(jobId);
      return json(result);
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
  }
  await deleteJob(jobId);
  return rpc(id, { content: [{ type: "text", text: "Windows client did not respond before the relay timeout." }], isError: true });
}

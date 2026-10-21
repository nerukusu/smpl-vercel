import { getJson, redis, setJson } from "./redis";
import { safeEqual, sha256 } from "./security";

export type ToolDefinition = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type DeviceRecord = {
  id: string;
  name: string;
  secretHash: string;
  tools: ToolDefinition[];
  registeredAt: number;
};

const key = (id: string) => `smpl:device:${id}`;
const heartbeatKey = (id: string) => `smpl:device:${id}:heartbeat`;
const queueKey = (id: string) => `smpl:device:${id}:queue`;

export async function registerDevice(record: DeviceRecord) {
  await setJson(key(record.id), record);
  await redis(["SADD", "smpl:devices", record.id]);
}

export async function getDevice(id: string) {
  return getJson<DeviceRecord>(key(id));
}

export async function authenticateDevice(request: Request): Promise<DeviceRecord | null> {
  const id = request.headers.get("x-smpl-device-id") || "";
  const auth = request.headers.get("authorization") || "";
  if (!id || !auth.startsWith("Bearer ")) return null;
  const record = await getDevice(id);
  if (!record) return null;
  return safeEqual(record.secretHash, sha256(auth.slice(7))) ? record : null;
}

export async function touchDevice(id: string) {
  await redis(["SET", heartbeatKey(id), String(Date.now()), "EX", 15]);
}

export async function isOnline(id: string) {
  return Boolean(await redis<string | null>(["GET", heartbeatKey(id)]));
}

export async function registeredDevice(): Promise<DeviceRecord | null> {
  const pinned = process.env.SMPL_DEVICE_ID;
  if (pinned) return getDevice(pinned);
  const ids = (await redis<string[]>(["SMEMBERS", "smpl:devices"])) || [];
  for (const id of ids) {
    const record = await getDevice(id);
    if (record) return record;
  }
  return null;
}

export async function onlineDevice(): Promise<DeviceRecord | null> {
  const pinned = process.env.SMPL_DEVICE_ID;
  if (pinned) {
    const record = await getDevice(pinned);
    return record && (await isOnline(pinned)) ? record : null;
  }
  const ids = (await redis<string[]>(["SMEMBERS", "smpl:devices"])) || [];
  for (const id of ids) {
    if (await isOnline(id)) {
      const record = await getDevice(id);
      if (record) return record;
    }
  }
  return null;
}

export async function enqueue(id: string, jobId: string) {
  await redis(["RPUSH", queueKey(id), jobId]);
}

export async function dequeue(id: string) {
  return redis<string | null>(["LPOP", queueKey(id)]);
}

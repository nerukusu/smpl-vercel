import { getJson, listJsonPrefix, setJson } from "./supabase";
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
const heartbeatKey = (id: string) => `smpl:heartbeat:${id}`;

export async function registerDevice(record: DeviceRecord) {
  await setJson(key(record.id), record);
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
  await setJson(heartbeatKey(id), Date.now(), 15);
}

export async function isOnline(id: string) {
  return (await getJson<number>(heartbeatKey(id))) !== null;
}

async function devices() {
  const rows = await listJsonPrefix<DeviceRecord>("smpl:device:");
  return rows.map((row) => row.value).filter((record) => record?.id);
}

export async function registeredDevice(): Promise<DeviceRecord | null> {
  const pinned = process.env.SMPL_DEVICE_ID;
  if (pinned) return getDevice(pinned);
  return (await devices())[0] || null;
}

export async function onlineDevice(): Promise<DeviceRecord | null> {
  const pinned = process.env.SMPL_DEVICE_ID;
  if (pinned) {
    const record = await getDevice(pinned);
    return record && (await isOnline(pinned)) ? record : null;
  }
  for (const record of await devices()) {
    if (await isOnline(record.id)) return record;
  }
  return null;
}

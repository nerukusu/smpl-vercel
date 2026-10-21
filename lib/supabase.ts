type KvRow = { key: string; value: unknown; expires_at: string | null };
type JobRow = {
  id: string;
  device_id: string;
  request: unknown;
  response: unknown | null;
  status: "pending" | "running" | "done";
  created_at: string;
  expires_at: string;
};

function credentials() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }
  return { url, key };
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = credentials();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const eq = (value: string) => `eq.${encodeURIComponent(value)}`;

export async function checkSupabase() {
  await rest<KvRow[]>("smpl_kv?select=key&limit=1");
}

export async function getJson<T>(key: string): Promise<T | null> {
  const rows = await rest<KvRow[]>(`smpl_kv?select=key,value,expires_at&key=${eq(key)}&limit=1`);
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.now()) {
    await delJson(key);
    return null;
  }
  return row.value as T;
}

export async function setJson(key: string, value: unknown, ttlSeconds?: number) {
  const expires_at = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
  await rest<void>("smpl_kv?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value, expires_at }),
  });
}

export async function delJson(key: string) {
  await rest<void>(`smpl_kv?key=${eq(key)}`, { method: "DELETE" });
}

export async function incrementJson(key: string, ttlSeconds: number) {
  const current = Number((await getJson<number>(key)) || 0) + 1;
  await setJson(key, current, ttlSeconds);
  return current;
}

export async function listJsonPrefix<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
  const pattern = encodeURIComponent(`${prefix}*`);
  const rows = await rest<KvRow[]>(`smpl_kv?select=key,value,expires_at&key=like.${pattern}&order=key.asc`);
  const now = Date.now();
  const valid: Array<{ key: string; value: T }> = [];
  for (const row of rows) {
    if (row.expires_at && Date.parse(row.expires_at) <= now) {
      await delJson(row.key);
      continue;
    }
    valid.push({ key: row.key, value: row.value as T });
  }
  return valid;
}

export async function createJob(id: string, deviceId: string, request: unknown, ttlSeconds = 90) {
  await rest<void>("smpl_jobs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id,
      device_id: deviceId,
      request,
      status: "pending",
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }),
  });
}

export async function claimNextJob(deviceId: string): Promise<{ id: string; request: unknown } | null> {
  await cleanupExpiredJobs();
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = await rest<JobRow[]>(
      `smpl_jobs?select=id,device_id,request,response,status,created_at,expires_at&device_id=${eq(deviceId)}&status=eq.pending&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc&limit=1`,
    );
    const row = rows[0];
    if (!row) return null;
    const claimed = await rest<JobRow[]>(`smpl_jobs?id=${eq(row.id)}&status=eq.pending`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "running" }),
    });
    if (claimed.length) return { id: row.id, request: row.request };
  }
  return null;
}

export async function getJob(id: string): Promise<JobRow | null> {
  const rows = await rest<JobRow[]>(
    `smpl_jobs?select=id,device_id,request,response,status,created_at,expires_at&id=${eq(id)}&limit=1`,
  );
  return rows[0] || null;
}

export async function completeJob(id: string, deviceId: string, response: unknown) {
  const rows = await rest<JobRow[]>(`smpl_jobs?id=${eq(id)}&device_id=${eq(deviceId)}&status=eq.running`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ response, status: "done" }),
  });
  return rows.length > 0;
}

export async function getJobResult(id: string): Promise<unknown | null> {
  const job = await getJob(id);
  return job?.status === "done" ? job.response : null;
}

export async function deleteJob(id: string) {
  await rest<void>(`smpl_jobs?id=${eq(id)}`, { method: "DELETE" });
}

export async function cleanupExpiredJobs() {
  await rest<void>(`smpl_jobs?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, { method: "DELETE" });
}

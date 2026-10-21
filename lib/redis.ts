type RedisScalar = string | number;

type RedisReply<T> = { result?: T; error?: string };

function credentials() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis is not configured. Set UPSTASH_REDIS_REST_URL/TOKEN.");
  return { url: url.replace(/\/$/, ""), token };
}

export async function redis<T = unknown>(command: RedisScalar[]): Promise<T> {
  const { url, token } = credentials();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
  const payload = (await response.json()) as RedisReply<T>;
  if (payload.error) throw new Error(payload.error);
  return payload.result as T;
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await redis<string | null>(["GET", key]);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setJson(key: string, value: unknown, ttlSeconds?: number) {
  const args: RedisScalar[] = ["SET", key, JSON.stringify(value)];
  if (ttlSeconds) args.push("EX", ttlSeconds);
  await redis(args);
}

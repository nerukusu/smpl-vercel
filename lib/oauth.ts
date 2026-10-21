import { getJson, redis, setJson } from "./redis";
import { origin, randomToken, safeEqual } from "./security";

export const SCOPES = ["mcp", "offline_access"];
export const ACCESS_TTL = 3600;
export const REFRESH_TTL = 90 * 24 * 3600;

export type OAuthClient = {
  client_id: string;
  client_secret: string | null;
  token_endpoint_auth_method: "client_secret_post" | "client_secret_basic" | "none";
  redirect_uris: string[];
  scope: string;
  client_name?: string;
  [key: string]: unknown;
};

export type TokenRecord = {
  client_id: string;
  scopes: string[];
  resource: string;
  expires_at: number;
};

export function resourceUrl(request: Request) {
  return `${origin(request)}/mcp`;
}

export function redirectAllowed(uri: string) {
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    if (u.protocol === "https:" && host === "chatgpt.com") {
      return u.pathname.startsWith("/connector/oauth/") || u.pathname === "/connector_platform_oauth_redirect";
    }
    if (u.protocol === "https:" && host === "chat.openai.com") return true;
    return ["127.0.0.1", "localhost", "::1"].includes(host) && ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

export async function saveClient(client: OAuthClient) {
  await setJson(`smpl:oauth:client:${client.client_id}`, client);
}

export async function getClient(id: string) {
  return getJson<OAuthClient>(`smpl:oauth:client:${id}`);
}

function basic(request: Request): [string, string] | null {
  const raw = request.headers.get("authorization") || "";
  if (!raw.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(raw.slice(6), "base64").toString("utf8");
    const at = decoded.indexOf(":");
    if (at < 0) return null;
    return [decodeURIComponent(decoded.slice(0, at)), decodeURIComponent(decoded.slice(at + 1))];
  } catch {
    return null;
  }
}

export async function authenticateClient(request: Request, form: URLSearchParams) {
  const parsedBasic = basic(request);
  const id = form.get("client_id") || parsedBasic?.[0] || "";
  const client = await getClient(id);
  if (!client) throw new Error("Invalid client_id");
  if (client.token_endpoint_auth_method === "none") return client;
  let supplied = form.get("client_secret") || "";
  if (client.token_endpoint_auth_method === "client_secret_basic") {
    if (!parsedBasic || parsedBasic[0] !== id) throw new Error("Invalid Basic authentication");
    supplied = parsedBasic[1];
  }
  if (!client.client_secret || !safeEqual(client.client_secret, supplied)) throw new Error("Invalid client_secret");
  return client;
}

export async function issueTokens(clientId: string, scopes: string[], resource: string) {
  const access = `at_${randomToken(40)}`;
  const refresh = `rt_${randomToken(48)}`;
  const now = Math.floor(Date.now() / 1000);
  await setJson(`smpl:oauth:access:${access}`, { client_id: clientId, scopes, resource, expires_at: now + ACCESS_TTL }, ACCESS_TTL);
  await setJson(`smpl:oauth:refresh:${refresh}`, { client_id: clientId, scopes, resource, expires_at: now + REFRESH_TTL }, REFRESH_TTL);
  return { access, refresh };
}

export async function validBearer(request: Request) {
  const raw = request.headers.get("authorization") || "";
  if (!raw.startsWith("Bearer ")) return false;
  const record = await getJson<TokenRecord>(`smpl:oauth:access:${raw.slice(7)}`);
  const now = Math.floor(Date.now() / 1000);
  return Boolean(record && record.expires_at > now && record.resource === resourceUrl(request) && record.scopes.includes("mcp"));
}

export async function revokeToken(token: string) {
  await redis(["DEL", `smpl:oauth:access:${token}`]);
  await redis(["DEL", `smpl:oauth:refresh:${token}`]);
}

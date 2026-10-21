import { getClient } from "@/lib/oauth";
import { getJson, redis, setJson } from "@/lib/redis";
import { ownerSecret, randomToken, safeEqual } from "@/lib/security";

export const runtime = "nodejs";

type Pending = {
  clientId: string;
  redirect: string;
  redirectExplicit: boolean;
  state: string | null;
  scopes: string[];
  resource: string;
  codeChallenge: string;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function page(id: string, client: string, scopes: string, error = "") {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SMPL Relay 認証</title><style>body{font-family:Segoe UI,sans-serif;background:#f4f6f8;margin:0;display:grid;place-items:center;min-height:100vh;color:#151515}.c{width:min(440px,calc(100vw - 40px));background:#fff;border-radius:20px;padding:28px;box-shadow:0 18px 60px #0002}input{box-sizing:border-box;width:100%;padding:12px 14px;font-size:16px;margin:10px 0 16px;border:1px solid #ccd1d8;border-radius:10px}button{padding:11px 17px;border:0;border-radius:10px;margin-right:8px;font-weight:650}.ok{background:#111;color:#fff}.no{background:#e9ebee}.err{color:#a5221f}</style></head><body><main class=c><h2>SMPL Windowsへ接続</h2><p><b>${esc(client)}</b> がWindows PCの操作ツールへアクセスしようとしています。</p><p>Scope: ${esc(scopes)}</p>${error ? `<p class=err>${esc(error)}</p>` : ""}<form method="post"><input type="hidden" name="id" value="${esc(id)}"><input type="password" name="password" placeholder="SMPL owner secret" required autofocus><button class="ok" name="action" value="allow">許可</button><button class="no" name="action" value="deny">拒否</button></form></main></body></html>`;
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  const pending = await getJson<Pending>(`smpl:oauth:pending:${id}`);
  if (!pending) return new Response("Authorization request expired", { status: 400 });
  const client = await getClient(pending.clientId);
  return new Response(page(id, client?.client_name || "ChatGPT / MCP client", pending.scopes.join(" ")), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") || "");
  const pending = await getJson<Pending>(`smpl:oauth:pending:${id}`);
  if (!pending) return new Response("Authorization request expired", { status: 400 });

  const callback = new URL(pending.redirect);
  if (pending.state) callback.searchParams.set("state", pending.state);
  if (String(form.get("action")) === "deny") {
    callback.searchParams.set("error", "access_denied");
    await redis(["DEL", `smpl:oauth:pending:${id}`]);
    return Response.redirect(callback, 303);
  }

  const attempts = Number(await redis<number>(["INCR", `smpl:oauth:attempts:${id}`]));
  await redis(["EXPIRE", `smpl:oauth:attempts:${id}`, 300]);
  if (attempts > 5) return new Response("Too many attempts", { status: 429 });

  let ok = false;
  try { ok = safeEqual(String(form.get("password") || ""), ownerSecret()); } catch {}
  if (!ok) {
    const client = await getClient(pending.clientId);
    return new Response(page(id, client?.client_name || "ChatGPT / MCP client", pending.scopes.join(" "), "パスワードが違います。"), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const code = `code_${randomToken(32)}`;
  await setJson(`smpl:oauth:code:${code}`, pending, 300);
  await redis(["DEL", `smpl:oauth:pending:${id}`]);
  callback.searchParams.set("code", code);
  return Response.redirect(callback, 303);
}

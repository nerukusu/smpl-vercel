'use client';

import { useEffect, useState } from "react";

type Status = {
  ok: boolean;
  configured: boolean;
  device: null | { id: string; name: string; online: boolean; registeredAt: number };
  error?: string;
};

export default function Home() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        const data = await response.json();
        if (alive) setStatus(data);
      } catch (error) {
        if (alive) setStatus({ ok: false, configured: false, device: null, error: String(error) });
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const online = status?.device?.online;

  return (
    <main className="wrap">
      <section className="hero">
        <span className="eyebrow">SMPL Relay</span>
        <h1>ChatGPT ↔ Windows</h1>
        <p className="lead">家庭側のポート開放なしで、WindowsのMRUS ControlへMCPリクエストを中継します。</p>
      </section>

      <section className="statusCard">
        <div>
          <span className={`dot ${online ? 'online' : 'offline'}`} />
          <strong>{online ? 'Windows client online' : 'Windows client offline'}</strong>
        </div>
        <dl>
          <div><dt>Vercel設定</dt><dd>{status?.configured ? 'OK' : '未設定'}</dd></div>
          <div><dt>端末</dt><dd>{status?.device?.name || '未登録'}</dd></div>
          <div><dt>MCP URL</dt><dd><code>{typeof window !== 'undefined' ? `${window.location.origin}/mcp` : '/mcp'}</code></dd></div>
        </dl>
        {status?.error && <p className="error">{status.error}</p>}
      </section>

      <section className="grid">
        <article>
          <span className="step">01</span>
          <h2>環境変数</h2>
          <p>Redis REST接続情報と <code>SMPL_OWNER_SECRET</code> をVercelへ設定します。</p>
        </article>
        <article>
          <span className="step">02</span>
          <h2>Windowsをペアリング</h2>
          <p><code>MRUS-Control.exe</code> を起動し、このサイトURLとowner secretを初回だけ入力します。</p>
        </article>
        <article>
          <span className="step">03</span>
          <h2>ChatGPTへ登録</h2>
          <p>MCP URLを <code>/mcp</code> にしてOAuth接続します。各tool callにPINは不要です。</p>
        </article>
      </section>

      <p className="foot">The Windows client makes outbound HTTPS requests only. No router port forwarding is required.</p>
    </main>
  );
}

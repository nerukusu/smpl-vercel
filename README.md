# smpl-vercel

Vercel上に置く、ChatGPT ↔ Windows MRUS Control 用のMCP中継です。

## 仕組み

```text
ChatGPT
   │ HTTPS / OAuth / MCP
   ▼
Vercel (smpl-vercel)
   │ Supabase queue
   ▼
Windows MRUS-Control.exe
   │ Windows API / PowerShell
   ▼
Windows PC
```

Windows側からVercelへ外向きHTTPS通信だけを行うため、家庭側ルーターのポート開放は不要です。
Vercel Functionsは常駐WebSocketサーバーには向かないため、Windowsクライアントは短い間隔で `/api/device/poll` をポーリングします。

## 必要なVercel環境変数

### `SMPL_OWNER_SECRET`

自分で決める強いパスワードです。次の2か所だけで使います。

- Windows exeの初回ペアリング
- ChatGPT OAuth接続時の承認画面

MCPの各tool callにはPINを追加しません。

### Supabase

中継状態とジョブキューはSupabaseに保存します。VercelのProduction環境に次を設定します。

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
```

初回だけSupabase SQL Editorでリポジトリの `supabase.sql` を実行してください。

### `SMPL_DEVICE_ID`（任意）

複数端末を登録したときに、ChatGPTから操作する端末を固定したい場合だけ設定します。

## デプロイ後

1. VercelのProduction URLを確認します。例: `https://smpl-vercel.vercel.app`
2. Windowsで `MRUS-Control.exe` を起動します。
3. 初回だけRelay URLと `SMPL_OWNER_SECRET` を入力します。
4. exeが端末専用のdevice secretを自動生成し、`%LOCALAPPDATA%\MRUS-Control\relay.json` に保存します。
5. トップページが `Windows client online` になれば中継準備完了です。

## ChatGPTへ登録

MCP URL:

```text
https://<your-vercel-domain>/mcp
```

認証方式はOAuthを選びます。このサーバーは次を実装しています。

- OAuth Authorization Code
- PKCE S256
- Dynamic Client Registration
- refresh token rotation
- RFC 9728 Protected Resource Metadata

接続時にブラウザで承認画面が開くので、`SMPL_OWNER_SECRET` を入力して許可します。

## セキュリティ

このMCPには制限なしのPowerShell実行やファイル操作が含まれます。`SMPL_OWNER_SECRET` とVercel/Supabaseの秘密情報は公開しないでください。

Windowsクライアントのdevice secretはランダム生成され、ChatGPTへは渡しません。Supabase側にはdevice secretそのものではなくSHA-256ハッシュだけを保存します。

## リレー制限

1回のMCP tool callはVercel側で最大約45秒待機します。長時間処理はクライアント側で完了してもChatGPT側が先にタイムアウトする場合があります。

スクリーンショット等はWindowsクライアント側でサイズを抑えて送る設計です。

## ローカル開発

```bash
npm install
npm run dev
```

`.env.local` には `.env.example` と同じ変数を設定してください。

## Windows relay client behavior

The Windows client pairs once with `SMPL_OWNER_SECRET`, then stores its generated device secret using Windows DPAPI. Normal MCP tool calls do **not** require a 32-character tool PIN.

The client connects outbound to this Vercel relay over HTTPS, so no inbound port forwarding is required on the Windows PC.

`run_shell` is intentionally restricted to a single form:

```text
cat <path>
```

The Windows client parses the path itself and invokes PowerShell with a fixed command using `Get-Content -LiteralPath`. The user-provided command string is not evaluated as PowerShell code. Other tool calls such as screenshots, mouse/keyboard input, app launch, and file operations are handled by the Windows client after initial pairing.

If the relay pairing needs to be reset, run the client with `--reset` and launch it again.

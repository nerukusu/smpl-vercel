import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMPL Relay",
  description: "Private MCP relay for MRUS Control on Windows",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

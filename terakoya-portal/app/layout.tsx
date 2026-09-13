import type { Metadata } from "next";
import "./globals.css";
import "./report-overrides.css";
import "./mobile-fixes.css";
import "./barrier.css";

export const metadata: Metadata = {
  title: "寺子屋ポータル",
  description: "竹林に佇む四寮学府。試験アンケート、寮分け、PONをひとつに。",
  openGraph: { title: "寺子屋ポータル", description: "学びが、寮の物語になる。", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: "寺子屋ポータル", description: "学びが、寮の物語になる。", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}

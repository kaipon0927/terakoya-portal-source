import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import PortalApp from "./portal-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className="signin-shell">
        <section className="signin-card">
          <div className="brand-mark">寺</div>
          <p className="eyebrow">竹林に佇む、四寮学府</p>
          <h1>寺子屋ポータル</h1>
          <p>学びの記録、寮分け、PONをひとつの場所に。</p>
          <a className="primary-button" href={chatGPTSignInPath("/")}>ログインしてはじめる</a>
        </section>
      </main>
    );
  }
  return <PortalApp identity={{ email: user.email, displayName: user.displayName }} />;
}

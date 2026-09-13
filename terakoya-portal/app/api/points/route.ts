import { and, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { getDb } from "../../../db";
import { pointRequests, users } from "../../../db/schema";

const amounts: Record<string, number> = {
  lecturer: 10000,
  problem: 5000,
  useful_app: 3000,
  report_complete: 1000,
  exam_complete: 1000,
  answer_question: 700,
  info: 500,
  impression: 300,
  post: 50,
  reaction: 30,
};

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as { category?: string; description?: string; evidenceUrl?: string };
  const category = body.category ?? "";
  if (!amounts[category]) return Response.json({ error: "申請種別を選んでください" }, { status: 400 });
  const description = body.description?.trim() ?? "";
  if (!description || description.length > 500) return Response.json({ error: "活動内容を500文字以内で入力してください" }, { status: 400 });
  const evidenceUrl = body.evidenceUrl?.trim() ?? "";
  if (evidenceUrl) {
    try { if (new URL(evidenceUrl).protocol !== "https:") throw new Error(); } catch { return Response.json({ error: "確認リンクはhttps://から始まるURLにしてください" }, { status: 400 }); }
  }
  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved") return Response.json({ error: "承認後に申請できます" }, { status: 403 });
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)` }).from(pointRequests).where(and(eq(pointRequests.userEmail, identity.email), eq(pointRequests.status, "pending")));
  if (Number(pending) >= 20) return Response.json({ error: "承認待ちが20件あります。総代の確認後に申請してください" }, { status: 429 });
  const [requestRow] = await db.insert(pointRequests).values({ userEmail: identity.email, category, amount: amounts[category], description, evidenceUrl }).returning();
  return Response.json({ request: requestRow });
}

import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { chimimoryoIndexes, houseIndexes, houseQuestions } from "../../house-questions";
import { getDb } from "../../../db";
import { houseResults, sortingBonusAwards, users } from "../../../db/schema";

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as { answers?: number[] };
  const answers = body.answers ?? [];
  if (answers.length !== houseQuestions.length || answers.some((value) => !Number.isInteger(value) || value < 0 || value > 3)) {
    return Response.json({ error: "28問すべてに回答してください" }, { status: 400 });
  }

  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved") return Response.json({ error: "承認後に診断できます" }, { status: 403 });
  const [existing] = await db.select().from(houseResults).where(eq(houseResults.userEmail, identity.email)).limit(1);
  if (existing) return Response.json({ error: "寮分け診断は1人1回です。所属寮の変更は総代が行います" }, { status: 409 });

  const scores = Object.fromEntries(Object.entries(houseIndexes).map(([house, indexes]) => {
    const total = indexes.reduce((sum, index) => sum + answers[index], 0);
    return [house, Math.round((total / (indexes.length * 3)) * 100)];
  })) as Record<string, number>;
  const chimimoryoTotal = chimimoryoIndexes.reduce((sum, index) => sum + answers[index], 0);
  const chimimoryoRate = Math.round((chimimoryoTotal / (chimimoryoIndexes.length * 3)) * 100);
  const chimimoryoStrong = chimimoryoIndexes.filter((index) => answers[index] >= 2).length;
  const house = chimimoryoStrong >= 4 ? "魑魅魍魎" : Object.entries(scores).sort((a,b) => b[1] - a[1])[0][0];

  await db.batch([
    db.insert(houseResults).values({ userEmail: identity.email, house, scoresJson: JSON.stringify(scores), answersJson: JSON.stringify(answers), chimimoryoRate }).onConflictDoUpdate({ target: houseResults.userEmail, set: { house, scoresJson: JSON.stringify(scores), answersJson: JSON.stringify(answers), chimimoryoRate, updatedAt: new Date().toISOString() } }),
    db.update(users).set({ house, pon: sql`${users.pon} + 300` }).where(eq(users.chatgptEmail, identity.email)),
    db.insert(sortingBonusAwards).values({ userEmail: identity.email, amount: 300 }),
  ]);
  return Response.json({ house, scores, chimimoryoRate, bonus: 300 });
}

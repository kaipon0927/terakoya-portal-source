import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { surveyCourseIds } from "../../courses";
import { getDb } from "../../../db";
import { difficultyRatings, pointRequests, surveyBonusAwards, users } from "../../../db/schema";

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved") {
    return Response.json({ error: "寺子屋参加の承認後に回答できます" }, { status: 403 });
  }
  if (profile.affiliation === "staff") {
    return Response.json({ error: "学校関係者は集計結果の閲覧のみ利用できます" }, { status: 403 });
  }

  const body = (await request.json()) as { ratings?: Record<string, number>; academicYear?: number; quarter?: number; respondentYear?: number };
  const academicYear=Number(body.academicYear); const quarter=Number(body.quarter); const respondentYear=Number(body.respondentYear);
  if(![2025,2026].includes(academicYear)||![1,2,3,4].includes(quarter)||![1,2].includes(respondentYear)){
    return Response.json({error:"履修年度・Q・受講時の学年を選んでください"},{status:400});
  }
  const entries = Object.entries(body.ratings ?? {}).filter(
    ([id, rating]) => surveyCourseIds.has(id) && Number.isInteger(rating) && rating >= 1 && rating <= 7,
  );
  if (!entries.length) return Response.json({ error: "回答がありません" }, { status: 400 });

  await db.batch(
    entries.map(([courseId, rating]) =>
      db
        .insert(difficultyRatings)
        .values({ userEmail: identity.email, courseId, rating, academicYear, quarter, respondentYear })
        .onConflictDoUpdate({
          target: [difficultyRatings.userEmail, difficultyRatings.courseId, difficultyRatings.academicYear, difficultyRatings.quarter],
          set: { rating, respondentYear, updatedAt: new Date().toISOString() },
        }),
    ),
  );
  const award=await db.insert(surveyBonusAwards).values({userEmail:identity.email,amount:500}).onConflictDoNothing().run();
  const bonus=Number(award.meta.changes??0)>0?500:0;
  if(bonus)await db.batch([db.update(users).set({pon:sql`${users.pon} + 500`}).where(eq(users.chatgptEmail,identity.email)),db.insert(pointRequests).values({userEmail:identity.email,category:"survey_bonus",amount:500,description:"試験アンケート初回回答",status:"approved",reviewedAt:new Date().toISOString()})]);
  return Response.json({ ok: true, bonus });
}

export async function DELETE(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser(); if (!identity) return Response.json({error:"ログインが必要です"},{status:401});
  const body=(await request.json()) as {courseId?:string;academicYear?:number;quarter?:number};
  const academicYear=Number(body.academicYear),quarter=Number(body.quarter);
  if(!body.courseId||![2025,2026].includes(academicYear)||![1,2,3,4].includes(quarter)) return Response.json({error:"削除対象が不正です"},{status:400});
  const db=getDb();
  await db.delete(difficultyRatings).where(sql`${difficultyRatings.userEmail}=${identity.email} AND ${difficultyRatings.courseId}=${body.courseId} AND ${difficultyRatings.academicYear}=${academicYear} AND ${difficultyRatings.quarter}=${quarter}`);
  return Response.json({ok:true});
}

import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { courses } from "../../courses";
import { getDb } from "../../../db";
import { gradeRatings, users } from "../../../db/schema";

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved") return Response.json({ error: "承認後に回答できます" }, { status: 403 });
  if (profile.affiliation === "staff") return Response.json({ error: "学校関係者は集計結果の閲覧のみ利用できます" }, { status: 403 });

  const body = (await request.json()) as { grades?: Record<string, number>; academicYear?: number; quarter?: number };
  const academicYear=Number(body.academicYear); const quarter=Number(body.quarter);
  if(![2025,2026].includes(academicYear)||![1,2,3,4].includes(quarter)) return Response.json({error:"年度とQを選んでください"},{status:400});
  const entries = Object.entries(body.grades ?? {}).filter(
    ([id, rating]) => Number(id) >= 0 && Number(id) < courses.length && Number.isInteger(rating) && rating >= 1 && rating <= 7,
  );
  if (!entries.length) return Response.json({ error: "回答がありません" }, { status: 400 });

  await db.batch(
    entries.map(([courseId, rating]) =>
      db
        .insert(gradeRatings)
        .values({ userEmail: identity.email, courseId, rating, academicYear, quarter })
        .onConflictDoUpdate({
          target: [gradeRatings.userEmail, gradeRatings.courseId, gradeRatings.academicYear, gradeRatings.quarter],
          set: { rating, updatedAt: new Date().toISOString() },
        }),
    ),
  );
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser(); if (!identity) return Response.json({error:"ログインが必要です"},{status:401});
  const body=(await request.json()) as {courseId?:string;academicYear?:number;quarter?:number};
  const academicYear=Number(body.academicYear),quarter=Number(body.quarter);
  if(!body.courseId||![2025,2026].includes(academicYear)||![1,2,3,4].includes(quarter)) return Response.json({error:"削除対象が不正です"},{status:400});
  const db=getDb();
  await db.delete(gradeRatings).where(sql`${gradeRatings.userEmail}=${identity.email} AND ${gradeRatings.courseId}=${body.courseId} AND ${gradeRatings.academicYear}=${academicYear} AND ${gradeRatings.quarter}=${quarter}`);
  return Response.json({ok:true});
}

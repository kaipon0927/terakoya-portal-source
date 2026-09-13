import { eq, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { courseName, surveyCourses } from "../../courses";
import { getDb } from "../../../db";
import { accessSettings, dailyLoginRewards, difficultyRatings, directMessages, gradeRatings, pointRequests, sortingBonusAwards, users } from "../../../db/schema";
import { ensureBarrierFinalRewards } from "../../barrier-rewards";

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });

  const db = getDb();
  await ensureBarrierFinalRewards();
  const slotCleanup = await env.DB.prepare("INSERT OR IGNORE INTO access_settings (key, code_hash, code_hint, enabled) VALUES ('slot_history_cleanup_v1', 'one-time-cleanup', 'スロット履歴削除済み', 0)").run();
  if (Number(slotCleanup.meta.changes ?? 0) > 0) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM slot_spins"),
      env.DB.prepare("DELETE FROM slot_sessions"),
      env.DB.prepare("DELETE FROM point_requests WHERE category = 'slot'"),
    ]);
  }
  let [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  const adminEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.trim().toLowerCase();
  const isAdmin = Boolean(adminEmail && identity.email.toLowerCase() === adminEmail);
  if (profile && isAdmin && (profile.status !== "approved" || profile.role !== "admin")) {
    await db.update(users).set({ status: "approved", role: "admin", house: profile.house ?? "勇往邁進" }).where(eq(users.chatgptEmail, identity.email));
    [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  }
  if (profile?.status === "pending") {
    await db.update(users).set({ status: "approved" }).where(eq(users.chatgptEmail, identity.email));
    [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  }
  if (profile?.role === "admin" && profile.status === "approved") {
    const marker = await env.DB.prepare("INSERT OR IGNORE INTO access_settings (key, code_hash, code_hint, enabled) VALUES ('founder_bonus_30000_v1', 'one-time-grant', '総代特別支給済み', 0)").run();
    if (Number(marker.meta.changes ?? 0) > 0) {
      await db.batch([
        db.insert(pointRequests).values({ userEmail: identity.email, category: "founder_bonus", amount: 30000, description: "総代特別支給", status: "approved", reviewedAt: new Date().toISOString() }),
        db.update(users).set({ pon: sql`${users.pon} + 30000` }).where(eq(users.chatgptEmail, identity.email)),
      ]);
      [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
    }
    const monitorApproval = await env.DB.prepare("INSERT OR IGNORE INTO access_settings (key, code_hash, code_hint, enabled) VALUES ('initial_monitor_approval_v1', 'one-time-approval', '初回モニター承認済み', 0)").run();
    if (Number(monitorApproval.meta.changes ?? 0) > 0) {
      await db.update(users).set({ status: "approved" }).where(eq(users.status, "pending"));
    }
  }
  let dailyBonus = 0;
  if (profile?.status === "approved") {
    const rewardDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const reward = await env.DB.prepare("INSERT OR IGNORE INTO daily_login_rewards (user_email, reward_date, amount) VALUES (?, ?, 10)").bind(identity.email, rewardDate).run();
    if (Number(reward.meta.changes ?? 0) > 0) {
      await db.update(users).set({ pon: sql`${users.pon} + 10` }).where(eq(users.chatgptEmail, identity.email));
      dailyBonus = 10;
      [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
    }
  }
  const ratings = profile
    ? await db.select().from(difficultyRatings).where(eq(difficultyRatings.userEmail, identity.email))
    : [];
  const grades = profile
    ? await db.select().from(gradeRatings).where(eq(gradeRatings.userEmail, identity.email))
    : [];
  const requests = profile
    ? await db.select().from(pointRequests).where(eq(pointRequests.userEmail, identity.email))
    : [];
  const dailyRewards = profile
    ? await db.select().from(dailyLoginRewards).where(eq(dailyLoginRewards.userEmail, identity.email))
    : [];
  const sortingRewards = profile
    ? await db.select().from(sortingBonusAwards).where(eq(sortingBonusAwards.userEmail, identity.email))
    : [];
  const messages = profile
    ? await db.select().from(directMessages).where(eq(directMessages.recipientEmail, identity.email))
    : [];
  const ponHistory = [
    ...requests.map((row) => ({ id: `request-${row.id}`, category: row.category, amount: row.amount, description: row.description, status: row.status, createdAt: row.createdAt })),
    ...dailyRewards.map((row) => ({ id: `daily-${row.id}`, category: "daily_login", amount: row.amount, description: "本日の来訪", status: "approved", createdAt: row.createdAt })),
    ...sortingRewards.map((row) => ({ id: `sorting-${row.id}`, category: "sorting_bonus", amount: row.amount, description: "初回組み分け完了", status: "approved", createdAt: row.createdAt })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rankingRows = await db
    .select({
      courseId: difficultyRatings.courseId,
      average: sql<number>`avg(${difficultyRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(difficultyRatings)
    .groupBy(difficultyRatings.courseId);
  const surveyDetailRows = await db
    .select({
      courseId: difficultyRatings.courseId,
      academicYear: difficultyRatings.academicYear,
      quarter: difficultyRatings.quarter,
      rating: difficultyRatings.rating,
      count: sql<number>`count(*)`,
    })
    .from(difficultyRatings)
    .groupBy(difficultyRatings.courseId, difficultyRatings.academicYear, difficultyRatings.quarter, difficultyRatings.rating);
  const gradeDetailRows = await db.select({courseId:gradeRatings.courseId,academicYear:gradeRatings.academicYear,quarter:gradeRatings.quarter,rating:gradeRatings.rating,count:sql<number>`count(*)`}).from(gradeRatings).groupBy(gradeRatings.courseId,gradeRatings.academicYear,gradeRatings.quarter,gradeRatings.rating);
  const [joinCodeSetting] = await db.select({ enabled: accessSettings.enabled }).from(accessSettings).where(eq(accessSettings.key, "join_code")).limit(1);
  const houseTotals = await db.select({house:users.house,members:sql<number>`count(*)`,pon:sql<number>`coalesce(sum(${users.pon}),0)`}).from(users).where(eq(users.status,"approved")).groupBy(users.house);

  const ratingPeriods = ratings.reduce<Record<string, Record<string, number>>>((periods, row) => {
    const key = `${row.academicYear}-${row.quarter}`;
    periods[key] ??= {};
    periods[key][row.courseId] = row.rating;
    return periods;
  }, {});

  return Response.json({
    identity: { email: identity.email, displayName: identity.displayName },
    profile: profile ?? null,
    dailyBonus,
    joinCodeRequired: Boolean(joinCodeSetting?.enabled),
    courses: surveyCourses,
    ratingPeriods,
    gradePeriods: grades.reduce<Record<string,Record<string,number>>>((periods,row)=>{const key=`${row.academicYear}-${row.quarter}`;periods[key]??={};periods[key][row.courseId]=row.rating;return periods;},{}),
    requests,
    ponHistory,
    messages: messages.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20),
    houseTotals:houseTotals.filter(row=>row.house).map(row=>({house:row.house as string,members:Number(row.members),pon:Number(row.pon)})).sort((a,b)=>b.pon-a.pon),
    rankings: rankingRows.map((row) => ({
      courseId: row.courseId,
      courseName: courseName(row.courseId),
      average: Number(row.average),
      count: Number(row.count),
    })),
    surveyDetails: surveyDetailRows.map((row) => ({
      courseId: row.courseId,
      courseName: courseName(row.courseId),
      academicYear: Number(row.academicYear),
      quarter: Number(row.quarter),
      rating: Number(row.rating),
      count: Number(row.count),
    })),
    gradeSurveyDetails: gradeDetailRows.map(row=>({courseId:row.courseId,courseName:courseName(row.courseId),academicYear:Number(row.academicYear),quarter:Number(row.quarter),rating:Number(row.rating),count:Number(row.count)})),
  });
}

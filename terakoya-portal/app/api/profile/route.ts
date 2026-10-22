import { and, eq, ne } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { getDb } from "../../../db";
import { accessSettings, users } from "../../../db/schema";
import { hashJoinCode, normalizeJoinCode } from "../../join-code";

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as { zenEmail?: string; slackName?: string; schoolYear?: number | null; affiliation?: string; joinCode?: string; avatarStyle?:number; avatarAccent?:string };
  const zenEmail = body.zenEmail?.trim().toLowerCase() ?? "";
  const slackName = body.slackName?.trim() ?? "";
  const affiliation = body.affiliation === "staff" ? "staff" : "student";
  const schoolYear = affiliation === "staff" ? null : Number(body.schoolYear);
  const allowedAccents=["vermilion","gold","green","blue","purple","pink"];
  const validEmail = affiliation === "staff" ? /^[a-z0-9._%+-]+@zen\.ac\.jp$/i.test(zenEmail) : /^[a-z0-9._%+-]+@student\.zen\.ac\.jp$/i.test(zenEmail);
  if (!slackName || slackName.length > 80 || zenEmail.length > 160 || !validEmail) {
    return Response.json({ error: affiliation === "staff" ? "Slack名とZEN大学関係者のメールを入力してください" : "student@example.invalidの大学メールを入力してください" }, { status: 400 });
  }
  if (affiliation === "student" && (!Number.isInteger(schoolYear) || Number(schoolYear) < 1 || Number(schoolYear) > 2)) {
    return Response.json({ error: "1年生または2年生を選んでください" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  const avatarStyle=body.avatarStyle===undefined?(existing?.avatarStyle??0):Math.max(0,Math.min(7,Math.floor(Number(body.avatarStyle))));
  const avatarAccent=body.avatarAccent===undefined?(existing?.avatarAccent??"vermilion"):(allowedAccents.includes(body.avatarAccent)?body.avatarAccent:"vermilion");
  if (existing && slackName !== existing.slackName) {
    return Response.json({ error: "Slack名は初回登録後に変更できません。修正が必要な場合は総代へ連絡してください" }, { status: 403 });
  }
  // Prevent account holders from silently changing the claimed university identity.
  // Existing email/affiliation changes need an administrator-mediated verification flow.
  if (existing && (zenEmail !== existing.zenEmail || affiliation !== existing.affiliation)) {
    return Response.json({ error: "大学メールアドレス・区分の変更は総代へ相談してください" }, { status: 403 });
  }
  const [duplicateEmail] = await db.select({ id: users.id }).from(users).where(and(eq(users.zenEmail, zenEmail), ne(users.chatgptEmail, identity.email))).limit(1);
  if (duplicateEmail) return Response.json({ error: "この大学メールは別のアカウントで登録済みです。総代へ確認してください" }, { status: 409 });
  const adminEmail = (env as unknown as { ADMIN_EMAIL?: string }).ADMIN_EMAIL?.trim().toLowerCase();
  const isAdmin = Boolean(adminEmail && identity.email.toLowerCase() === adminEmail);
  // A typed university email address is not proof of ownership.
  // New accounts require explicit administrator review; keep existing users' statuses.
  const status = isAdmin ? "approved" : (existing?.status ?? "pending");
  if (!existing && !isAdmin) {
    const [setting] = await db.select().from(accessSettings).where(eq(accessSettings.key, "join_code")).limit(1);
    if (setting?.enabled) {
      const code = typeof body.joinCode === "string" ? normalizeJoinCode(body.joinCode) : "";
      if (code.length < 8 || code.length > 48 || await hashJoinCode(code) !== setting.codeHash) {
        return Response.json({ error: "寺子屋入学コードが正しくありません" }, { status: 403 });
      }
    }
  }
  await db
    .insert(users)
    .values({
      chatgptEmail: identity.email,
      zenEmail,
      slackName,
      schoolYear,
      affiliation,
      status,
      role: isAdmin ? "admin" : "member",
      house: isAdmin ? "勇往邁進" : null,
      avatarStyle,
      avatarAccent,
    })
    .onConflictDoUpdate({
      target: users.chatgptEmail,
      set: {
        zenEmail,
        slackName,
        schoolYear,
        affiliation,
        avatarStyle,
        avatarAccent,
        ...(isAdmin ? { status: "approved", role: "admin", house: "勇往邁進" } : {}),
      },
    });
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  return Response.json({ profile });
}

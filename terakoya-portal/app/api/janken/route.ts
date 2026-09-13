import { and, desc, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { getDb } from "../../../db";
import { gameSettings, jankenRounds, pointRequests, users } from "../../../db/schema";

const hands = ["rock", "scissors", "paper"] as const;
type Hand = (typeof hands)[number];

const defaultPayouts = { 10: 30, 50: 150, 100: 300 } as const;

async function settings() {
  const db = getDb();
  const [row] = await db.select().from(gameSettings).where(eq(gameSettings.game, "janken")).limit(1);
  const payouts = row ? { 10: Math.min(30,row.payout10), 50: Math.min(150,row.payout50), 100: Math.min(300,row.payout100) } : defaultPayouts;
  const winChance = Math.max(1, Math.min(18, row?.winChance ?? 18));
  const drawChance = Math.max(0, Math.min(30, row?.drawChance ?? 12));
  return { db, payouts, winChance, drawChance };
}

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const current = await settings();
  return Response.json({ payouts: current.payouts, winChance: current.winChance, drawChance: current.drawChance });
}

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as { hand?: Hand; wager?: number };
  const hand = body.hand;
  const wager = Number(body.wager);
  if (!hand || !hands.includes(hand) || ![10, 50, 100].includes(wager)) return Response.json({ error: "手と賭けるPONを選んでください" }, { status: 400 });

  const current = await settings();
  const db = current.db;
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved" || !profile.house) return Response.json({ error: "組み分け後に遊べます" }, { status: 403 });
  if (profile.pon < wager) return Response.json({ error: "PONが足りません" }, { status: 400 });

  const [{ recent }] = await db.select({ recent: sql<number>`count(*)` }).from(pointRequests).where(and(eq(pointRequests.userEmail, identity.email), eq(pointRequests.category, "janken"), sql`${pointRequests.createdAt} >= datetime('now', '-5 seconds')`));
  if (Number(recent) > 0) return Response.json({ error: "かいぽんが考え中です。少し待ってね" }, { status: 429 });

  const recentRounds = await db.select({ result: jankenRounds.result }).from(jankenRounds).where(eq(jankenRounds.userEmail, identity.email)).orderBy(desc(jankenRounds.id)).limit(12);
  let lossStreak = 0; for (const round of recentRounds) { if (round.result !== "lose") break; lossStreak += 1; }
  let winStreak = 0; for (const round of recentRounds) { if (round.result !== "win") break; winStreak += 1; }
  const pityBoost = Math.min(9, lossStreak * 3);
  const winChance = current.winChance + pityBoost;
  const drawChance = current.drawChance;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const roll = array[0] % 100;
  const result = roll < winChance ? "win" : roll < winChance + drawChance ? "draw" : "lose";
  const winningAgainst:Record<Hand,Hand>={rock:"scissors",scissors:"paper",paper:"rock"};
  const losingAgainst:Record<Hand,Hand>={rock:"paper",scissors:"rock",paper:"scissors"};
  const kaiponHand = result === "draw" ? hand : result === "win" ? winningAgainst[hand] : losingAgainst[hand];
  const nextWinStreak = result === "win" ? winStreak + 1 : 0;
  const streakBonusRate = 0;
  const basePayout = result === "win" ? current.payouts[wager as 10 | 50 | 100] : 0;
  const streakBonus = Math.floor(basePayout * streakBonusRate / 100);
  const payout = basePayout + streakBonus;
  const change = result === "win" ? payout - wager : result === "lose" ? -wager : 0;
  const description = `あなた:${hand} / かいぽん:${kaiponHand} / ${result} / BET:${wager} / 払戻:${payout} / 最終増減:${change} / 連勝:${nextWinStreak} / 救済:${pityBoost}%`;

  await db.batch([
    db.insert(pointRequests).values({ userEmail: identity.email, category: "janken", amount: change, description, status: "approved", reviewedAt: new Date().toISOString() }),
    db.insert(jankenRounds).values({ userEmail: identity.email, wager, payout, result, playerHand: hand, kaiponHand }),
    ...(change !== 0 ? [db.update(users).set({ pon: sql`${users.pon} + ${change}` }).where(and(eq(users.chatgptEmail, identity.email), sql`${users.pon} >= ${wager}`))] : []),
  ]);
  const [updated] = await db.select({ pon: users.pon }).from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  return Response.json({ result, hand, kaiponHand, change, payout, pon: updated.pon, winStreak: nextWinStreak, lossStreak: result === "lose" ? lossStreak + 1 : 0, streakBonus, streakBonusRate, pityBoost: result === "lose" ? Math.min(9,(lossStreak+1)*3) : 0 });
}

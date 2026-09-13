import { and, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { getDb } from "../../../db";
import { pointRequests, slotSessions, slotSpins, users } from "../../../db/schema";

const symbolDefinitions = {
  shiba: { id: "shiba", label: "柴犬" },
  luckycat: { id: "luckycat", label: "招き猫" },
  coin: { id: "coin", label: "金のPON小判" },
  phoenix: { id: "phoenix", label: "鳳凰" },
  bamboo: { id: "bamboo", label: "竹" },
  torii: { id: "torii", label: "鳥居" },
  scroll: { id: "scroll", label: "巻物" },
} as const;
type SymbolId = keyof typeof symbolDefinitions;

const reelStrips: readonly SymbolId[][] = [
  ["shiba","bamboo","torii","scroll","luckycat","coin","phoenix","bamboo","scroll","torii","luckycat","coin","bamboo","phoenix","scroll","torii"],
  ["shiba","scroll","bamboo","luckycat","phoenix","torii","coin","scroll","bamboo","torii","luckycat","coin","scroll","phoenix","torii","bamboo"],
  ["shiba","torii","scroll","coin","bamboo","phoenix","luckycat","torii","bamboo","scroll","coin","luckycat","torii","phoenix","bamboo","scroll"],
];
const reelSpeeds = [112, 106, 100] as const;

function randomIndex(length: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}

function calculateResult(symbols: SymbolId[], wager: number) {
  const counts = symbols.reduce<Record<string, number>>((map, symbol) => ({ ...map, [symbol]: (map[symbol] ?? 0) + 1 }), {});
  const triple = symbols.every((symbol) => symbol === symbols[0]);
  const pair = (["shiba","luckycat","coin"] as SymbolId[]).some((symbol) => counts[symbol] === 2);
  const fortuneSet = new Set(symbols);
  const fortuneMix = fortuneSet.has("shiba") && fortuneSet.has("luckycat") && fortuneSet.has("coin");
  const result = triple ? symbols[0] === "shiba" ? "jackpot" : symbols[0] === "luckycat" ? "luckycat" : symbols[0] === "coin" ? "coin" : symbols[0] === "phoenix" ? "phoenix" : "triple" : fortuneMix ? "fortune" : pair ? "pair" : "lose";
  const multiplier = result === "jackpot" ? 100 : result === "luckycat" ? 20 : result === "coin" || result === "fortune" ? 10 : result === "phoenix" ? 5 : result === "triple" ? 2 : result === "pair" ? 1.5 : 0;
  const payout = Math.round(wager * multiplier);
  return { result, multiplier, payout, change: payout - wager };
}

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  return Response.json({
    symbols: Object.values(symbolDefinitions),
    paytable: [
      { result: "jackpot", label: "柴犬三つ", multiplier: 100 },
      { result: "luckycat", label: "招き猫三つ", multiplier: 20 },
      { result: "coin", label: "金のPON小判三つ", multiplier: 10 },
      { result: "fortune", label: "柴犬・招き猫・小判", multiplier: 10 },
      { result: "phoenix", label: "鳳凰三つ", multiplier: 5 },
      { result: "triple", label: "そのほか三つ", multiplier: 2 },
      { result: "pair", label: "二つ揃い", multiplier: 2 },
    ],
  });
}

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as { action?: "start" | "stop" | "auto"; wager?: number; sessionId?: string; reelIndex?: number };
  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved" || !profile.house) return Response.json({ error: "組み分け後に遊べます" }, { status: 403 });

  if (body.action === "start") {
    const wager = Number(body.wager);
    if (![10, 50, 100].includes(wager)) return Response.json({ error: "賭けるPONを選んでください" }, { status: 400 });
    if (profile.pon < wager) return Response.json({ error: "PONが足りません" }, { status: 400 });
    const [{ recent }] = await db.select({ recent: sql<number>`count(*)` }).from(pointRequests).where(and(eq(pointRequests.userEmail, identity.email), eq(pointRequests.category, "slot"), sql`${pointRequests.createdAt} >= datetime('now', '-2 seconds')`));
    if (Number(recent) > 0) return Response.json({ error: "竹の回転が止まるまで少し待ってね" }, { status: 429 });
    const sessionId = crypto.randomUUID();
    const phases = reelStrips.map((strip) => randomIndex(strip.length));
    const startedAt = Date.now();
    await db.batch([
      db.insert(slotSessions).values({ id: sessionId, userEmail: identity.email, wager, startMs: startedAt, phasesJson: JSON.stringify(phases) }),
      db.insert(pointRequests).values({ userEmail: identity.email, category: "slot", amount: -wager, description: `かいぽん大回転開始 / BET:${wager}`, status: "approved", reviewedAt: new Date().toISOString() }),
      db.update(users).set({ pon: sql`${users.pon} - ${wager}` }).where(and(eq(users.chatgptEmail, identity.email), sql`${users.pon} >= ${wager}`)),
    ]);
    return Response.json({ sessionId, startedAt, phases, pon: profile.pon - wager });
  }

  if (!body.sessionId || !["stop", "auto"].includes(body.action ?? "")) return Response.json({ error: "操作が不正です" }, { status: 400 });
  const [session] = await db.select().from(slotSessions).where(and(eq(slotSessions.id, body.sessionId), eq(slotSessions.userEmail, identity.email), eq(slotSessions.status, "active"))).limit(1);
  if (!session) return Response.json({ error: "この回転は終了しています" }, { status: 404 });
  const stopped = JSON.parse(session.stopsJson) as SymbolId[];
  const phases = JSON.parse(session.phasesJson) as number[];
  async function finish(nextStopped: SymbolId[]) {
    const settledSymbols=[...nextStopped];
    const outcome = calculateResult(settledSymbols, session.wager);
    const description = `${settledSymbols.map((id) => symbolDefinitions[id].label).join("・")} / ${outcome.result} / BET:${session.wager} / 払戻:${outcome.payout}`;
    const claimed = await db.update(slotSessions).set({ stopsJson: JSON.stringify(settledSymbols), status: "complete" }).where(and(eq(slotSessions.id, session.id), eq(slotSessions.status, "active"), eq(slotSessions.stopsJson, session.stopsJson))).returning({ id: slotSessions.id });
    if (!claimed.length) return Response.json({ error: "この回転はすでに終了しています" }, { status: 409 });
    await db.batch([
      db.insert(slotSpins).values({ userEmail: identity.email, wager: session.wager, payout: outcome.payout, result: outcome.result, symbolsJson: JSON.stringify(settledSymbols) }),
      ...(outcome.payout > 0 ? [
        db.insert(pointRequests).values({ userEmail: identity.email, category: "slot", amount: outcome.payout, description, status: "approved", reviewedAt: new Date().toISOString() }),
        db.update(users).set({ pon: sql`${users.pon} + ${outcome.payout}` }).where(eq(users.chatgptEmail, identity.email)),
      ] : []),
    ]);
    const [updated] = await db.select({ pon: users.pon }).from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
    return Response.json({ stopped: 3, symbol: symbolDefinitions[settledSymbols[settledSymbols.length - 1]], symbols: settledSymbols.map((id) => symbolDefinitions[id]), wager: session.wager, ...outcome, pon: updated.pon });
  }

  if (body.action === "auto") {
    const nextStopped = [...stopped];
    const baseTime = Date.now();
    for (let index = stopped.length; index < 3; index += 1) {
      const strip = reelStrips[index];
      const simulatedTime = baseTime + (index - stopped.length) * 260;
      const position = (phases[index] + Math.floor((simulatedTime - session.startMs) / reelSpeeds[index])) % strip.length;
      nextStopped.push(strip[position]);
    }
    return finish(nextStopped);
  }

  if (!Number.isInteger(body.reelIndex)) return Response.json({ error: "止めるリールを選んでください" }, { status: 400 });
  const reelIndex = Number(body.reelIndex);
  if (reelIndex !== stopped.length || reelIndex < 0 || reelIndex > 2) return Response.json({ error: "左のリールから順番に止めてください" }, { status: 400 });
  if (Date.now() - session.startMs > 30_000) {
    await db.update(slotSessions).set({ status: "expired" }).where(eq(slotSessions.id, session.id));
    return Response.json({ error: "時間切れです。BET分は戻りません" }, { status: 410 });
  }
  const strip = reelStrips[reelIndex];
  const position = (phases[reelIndex] + Math.floor((Date.now() - session.startMs) / reelSpeeds[reelIndex])) % strip.length;
  const symbolId = strip[position];
  const nextStopped = [...stopped, symbolId];
  const symbol = symbolDefinitions[symbolId];
  if (nextStopped.length < 3) {
    const claimed = await db.update(slotSessions).set({ stopsJson: JSON.stringify(nextStopped) }).where(and(eq(slotSessions.id, session.id), eq(slotSessions.status, "active"), eq(slotSessions.stopsJson, session.stopsJson))).returning({ id: slotSessions.id });
    if (!claimed.length) return Response.json({ error: "そのリールはすでに止まっています" }, { status: 409 });
    return Response.json({ stopped: nextStopped.length, symbol });
  }

  return finish(nextStopped);
}

import { and, desc, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { getDb } from "../../../db";
import { baccaratRounds, gameSettings, pointRequests, users } from "../../../db/schema";

type BetOn = "player" | "banker" | "tie";
type Card = { suit: "♠" | "♥" | "♦" | "♣"; rank: string; value: number };
const suits: Card["suit"][] = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function randomIndex(length: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}

function createShoe() {
  const shoe: Card[] = [];
  for (let deck = 0; deck < 8; deck += 1) for (const suit of suits) for (const rank of ranks) shoe.push({ suit, rank, value: rank === "A" ? 1 : Number(rank) >= 2 && Number(rank) <= 9 ? Number(rank) : 0 });
  return shoe;
}

function draw(shoe: Card[]) {
  return shoe.splice(randomIndex(shoe.length), 1)[0];
}

function score(cards: Card[]) {
  return cards.reduce((total, card) => total + card.value, 0) % 10;
}

function dealRound() {
  const shoe = createShoe();
  const player = [draw(shoe), draw(shoe)];
  const banker = [draw(shoe), draw(shoe)];
  let playerScore = score(player);
  let bankerScore = score(banker);
  if (playerScore < 8 && bankerScore < 8) {
    let thirdValue: number | null = null;
    if (playerScore <= 5) { const card = draw(shoe); player.push(card); thirdValue = card.value; }
    const bankerDraws = thirdValue === null
      ? bankerScore <= 5
      : bankerScore <= 2 || (bankerScore === 3 && thirdValue !== 8) || (bankerScore === 4 && thirdValue >= 2 && thirdValue <= 7) || (bankerScore === 5 && thirdValue >= 4 && thirdValue <= 7) || (bankerScore === 6 && thirdValue >= 6 && thirdValue <= 7);
    if (bankerDraws) banker.push(draw(shoe));
    playerScore = score(player); bankerScore = score(banker);
  }
  const winner: BetOn = playerScore === bankerScore ? "tie" : playerScore > bankerScore ? "player" : "banker";
  return { player, banker, playerScore, bankerScore, winner };
}

async function baccaratSettings() {
  const db = getDb();
  const [row] = await db.select().from(gameSettings).where(eq(gameSettings.game, "baccarat")).limit(1);
  const playerChance = Math.max(1, Math.min(98, row?.winChance ?? 45));
  const tieChance = Math.max(0, Math.min(30, row?.drawChance ?? 10));
  const bankerChance = Math.max(1, 100 - playerChance - tieChance);
  return { db, playerChance, bankerChance, tieChance };
}

function configuredRound(playerChance:number,tieChance:number) {
  const value = new Uint32Array(1); crypto.getRandomValues(value); const roll=value[0]%100;
  const target:BaccaratSide=roll<playerChance?"player":roll<playerChance+tieChance?"tie":"banker";
  for(let attempt=0;attempt<120;attempt+=1){const round=dealRound();if(round.winner===target)return round;}
  return dealRound();
}

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const settings = await baccaratSettings();
  const db = settings.db;
  const history = await db.select({ id:baccaratRounds.id,betOn:baccaratRounds.betOn,winner:baccaratRounds.winner,wager:baccaratRounds.wager,payout:baccaratRounds.payout,playerScore:baccaratRounds.playerScore,bankerScore:baccaratRounds.bankerScore,createdAt:baccaratRounds.createdAt }).from(baccaratRounds).where(eq(baccaratRounds.userEmail, identity.email)).orderBy(desc(baccaratRounds.id)).limit(10);
  return Response.json({ history, chances:{player:settings.playerChance,banker:settings.bankerChance,tie:settings.tieChance} });
}

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await request.json()) as { betOn?: BetOn; wager?: number };
  const betOn = body.betOn;
  const wager = Number(body.wager);
  if (!betOn || !["player","banker","tie"].includes(betOn) || ![10,50,100].includes(wager)) return Response.json({ error: "賭け先とBETを選んでください" }, { status: 400 });
  const settings = await baccaratSettings();
  const db = settings.db;
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved" || !profile.house) return Response.json({ error: "組み分け後に遊べます" }, { status: 403 });
  const [{ recent }] = await db.select({ recent: sql<number>`count(*)` }).from(baccaratRounds).where(and(eq(baccaratRounds.userEmail, identity.email), sql`${baccaratRounds.createdAt} >= datetime('now', '-2 seconds')`));
  if (Number(recent) > 0) return Response.json({ error: "札を片づけています。少し待ってください" }, { status: 429 });
  const claimed = await db.update(users).set({ pon: sql`${users.pon} - ${wager}` }).where(and(eq(users.chatgptEmail, identity.email), sql`${users.pon} >= ${wager}`)).returning({ pon: users.pon });
  if (!claimed.length) return Response.json({ error: "PONが足りません" }, { status: 400 });
  const round = configuredRound(settings.playerChance,settings.tieChance);
  const push = round.winner === "tie" && betOn !== "tie";
  const won = round.winner === betOn;
  const payout = push ? wager : !won ? 0 : betOn === "player" ? wager * 2 : betOn === "banker" ? wager + Math.floor(wager * 0.95) : wager * 9;
  const change = payout - wager;
  const description = `五寮バカラ / BET:${wager} / 賭け先:${betOn} / 勝者:${round.winner} / 払戻:${payout} / 収支:${change}`;
  await db.batch([
    db.insert(baccaratRounds).values({ userEmail:identity.email,house:profile.house,wager,betOn,winner:round.winner,payout,playerCardsJson:JSON.stringify(round.player),bankerCardsJson:JSON.stringify(round.banker),playerScore:round.playerScore,bankerScore:round.bankerScore }),
    db.insert(pointRequests).values({ userEmail:identity.email,category:"baccarat",amount:change,description,status:"approved",reviewedAt:new Date().toISOString() }),
    ...(payout > 0 ? [db.update(users).set({ pon: sql`${users.pon} + ${payout}` }).where(eq(users.chatgptEmail, identity.email))] : []),
  ]);
  const [updated] = await db.select({ pon:users.pon }).from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  return Response.json({ ...round,betOn,wager,payout,change,result:push?"push":won?"win":"lose",pon:updated.pon });
}

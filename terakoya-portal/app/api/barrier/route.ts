import { and, eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { getDb } from "../../../db";
import { barrierBattleAttempts, users } from "../../../db/schema";

const EVENT_END = Date.parse("2026-08-31T14:59:59Z");
const EVENT_END_DB = "2026-08-31 14:59:59";
const BOSS_HP = 500000;
const houses=["勇往邁進","一期一会","泰然自若","幽玄無限","魑魅魍魎"];
function battleDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.now()-5*60*60*1000));}
function distinctAttemptCount(rows:Array<{createdAt:string;damage:number;taps:number}>){
  const attempts=rows.map(row=>({...row,time:Date.parse(row.createdAt.endsWith("Z")?row.createdAt:`${row.createdAt.replace(" ","T")}Z`)})).filter(row=>Number.isFinite(row.time)).sort((a,b)=>a.time-b.time);
  let count=0;const previousByResult=new Map<string,number>();
  for(const attempt of attempts){const key=`${attempt.damage}:${attempt.taps}`;const previous=previousByResult.get(key)??-Infinity;if(attempt.time-previous>60000)count+=1;previousByResult.set(key,attempt.time);}
  return count;
}
async function payload(email:string,house:string){
  const db=getDb();
  const [total]=await db.select({damage:sql<number>`coalesce(sum(${barrierBattleAttempts.damage}),0)`,participants:sql<number>`count(distinct ${barrierBattleAttempts.userEmail})`}).from(barrierBattleAttempts);
  const rows=await db.select({house:barrierBattleAttempts.house,damage:sql<number>`coalesce(sum(${barrierBattleAttempts.damage}),0)`,participants:sql<number>`count(distinct ${barrierBattleAttempts.userEmail})`}).from(barrierBattleAttempts).groupBy(barrierBattleAttempts.house);
  const participantRows=await db.select({userEmail:barrierBattleAttempts.userEmail,slackName:users.slackName,house:barrierBattleAttempts.house,attempts:sql<number>`count(*)`,damage:sql<number>`coalesce(sum(${barrierBattleAttempts.damage}),0)`,lastAt:sql<string>`max(${barrierBattleAttempts.createdAt})`}).from(barrierBattleAttempts).leftJoin(users,eq(users.chatgptEmail,barrierBattleAttempts.userEmail)).groupBy(barrierBattleAttempts.userEmail,barrierBattleAttempts.house,users.slackName);
  const memberRows=await db.select({house:users.house,members:sql<number>`count(*)`}).from(users).where(and(eq(users.status,"approved"),sql`${users.house} is not null`,sql`${users.createdAt} <= ${EVENT_END_DB}`)).groupBy(users.house);
  const attemptRows=await db.select({createdAt:barrierBattleAttempts.createdAt,damage:barrierBattleAttempts.damage,taps:barrierBattleAttempts.taps}).from(barrierBattleAttempts).where(and(eq(barrierBattleAttempts.userEmail,email),eq(barrierBattleAttempts.battleDate,battleDate())));
  const attempts=distinctAttemptCount(attemptRows);
  const combined=houses.map(name=>{const row=rows.find(item=>item.house===name);const members=Number(memberRows.find(item=>item.house===name)?.members??0);return{house:name,damage:Number(row?.damage??0),participants:Number(row?.participants??0),members};});
  const maxAvg=Math.max(1,...combined.map(item=>item.damage/Math.max(1,item.members)));const maxRate=Math.max(.01,...combined.map(item=>item.participants/Math.max(1,item.members)));const maxTotal=Math.max(1,...combined.map(item=>item.damage));
  const standings=combined.map(item=>({...item,participationRate:Math.round(item.participants/Math.max(1,item.members)*100),score:Math.round(((item.damage/Math.max(1,item.members))/maxAvg*.4+(item.participants/Math.max(1,item.members))/maxRate*.4+item.damage/maxTotal*.2)*1000)})).sort((a,b)=>b.score-a.score);
  const curse=["睡魔の呪い――眠くなる前に受験時刻を確認せよ。","油断の呪い――『あとでやる』を信じるな。","記憶封じ――眺めただけの資料は覚えたことにならない。","未受験の呪い――受験完了画面まで見届けよ。"][new Date().getDate()%4];
  return{eventActive:Date.now()<=EVENT_END,eventEndsAt:"2026-08-31T23:59:59+09:00",bossHp:BOSS_HP,totalDamage:Number(total.damage),remainingHp:Math.max(0,BOSS_HP-Number(total.damage)),totalParticipants:Number(total.participants),attemptsRemaining:Math.max(0,3-attempts),house,standings,participants:participantRows.map(row=>({slackName:row.slackName??"登録者",house:row.house,attempts:Number(row.attempts),damage:Number(row.damage),lastAt:row.lastAt})).sort((a,b)=>b.damage-a.damage),curse};
}
export async function GET(){const identity=await getChatGPTUser();if(!identity)return Response.json({error:"ログインが必要です"},{status:401});const db=getDb();const[profile]=await db.select().from(users).where(eq(users.chatgptEmail,identity.email)).limit(1);if(!profile||profile.status!=="approved"||!profile.house)return Response.json({error:"組み分け後に出陣できます"},{status:403});return Response.json(await payload(identity.email,profile.house));}
export async function POST(request:Request){const invalid=validateJsonMutation(request);if(invalid)return invalid;const identity=await getChatGPTUser();if(!identity)return Response.json({error:"ログインが必要です"},{status:401});if(Date.now()>EVENT_END)return Response.json({error:"結界戦は終了しました"},{status:400});const body=await request.json() as {taps?:number;damage?:number};const taps=Math.floor(Number(body.taps));const damage=Math.floor(Number(body.damage));if(!Number.isInteger(taps)||!Number.isInteger(damage)||taps<1||taps>120||damage<100||damage>5000||damage>taps*120+500)return Response.json({error:"戦闘記録を確認できませんでした"},{status:400});const db=getDb();const[profile]=await db.select().from(users).where(eq(users.chatgptEmail,identity.email)).limit(1);if(!profile||profile.status!=="approved"||!profile.house)return Response.json({error:"組み分け後に出陣できます"},{status:403});const date=battleDate();const attemptRows=await db.select({createdAt:barrierBattleAttempts.createdAt,damage:barrierBattleAttempts.damage,taps:barrierBattleAttempts.taps}).from(barrierBattleAttempts).where(and(eq(barrierBattleAttempts.userEmail,identity.email),eq(barrierBattleAttempts.battleDate,date)));const attempts=distinctAttemptCount(attemptRows);const latest=Math.max(-Infinity,...attemptRows.map(row=>Date.parse(row.createdAt.endsWith("Z")?row.createdAt:`${row.createdAt.replace(" ","T")}Z`)).filter(Number.isFinite));if(Date.now()-latest<=8000)return Response.json({...(await payload(identity.email,profile.house)),damage});if(attempts>=3)return Response.json({error:"本日の出陣は3回までです"},{status:429});await db.insert(barrierBattleAttempts).values({userEmail:identity.email,house:profile.house,battleDate:date,damage,taps});return Response.json({...(await payload(identity.email,profile.house)),damage});}

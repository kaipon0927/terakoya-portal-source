import { and, eq, inArray, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { baccaratRounds, houseContributions, jankenRounds, pointRequests, slotSpins, users } from "../../../db/schema";

type Totals={spent:number;profit:number;donated:number;plays:number;jankenProfit:number;slotProfit:number;baccaratProfit:number;biggestPayout:number};
export async function GET(){
  const identity=await getChatGPTUser();if(!identity)return Response.json({error:"ログインが必要です"},{status:401});
  const db=getDb();const [viewer]=await db.select({status:users.status}).from(users).where(eq(users.chatgptEmail,identity.email)).limit(1);
  if(!viewer||viewer.status!=="approved")return Response.json({error:"寺子屋参加者限定です"},{status:403});
  const [janken,slot,baccarat,donations,people,requests]=await Promise.all([
    db.select({email:jankenRounds.userEmail,spent:sql<number>`coalesce(sum(${jankenRounds.wager}),0)`,payout:sql<number>`coalesce(sum(${jankenRounds.payout}),0)`,plays:sql<number>`count(*)`}).from(jankenRounds).groupBy(jankenRounds.userEmail),
    db.select({email:slotSpins.userEmail,spent:sql<number>`coalesce(sum(${slotSpins.wager}),0)`,payout:sql<number>`coalesce(sum(${slotSpins.payout}),0)`,plays:sql<number>`count(*)`}).from(slotSpins).groupBy(slotSpins.userEmail),
    db.select({email:baccaratRounds.userEmail,spent:sql<number>`coalesce(sum(${baccaratRounds.wager}),0)`,payout:sql<number>`coalesce(sum(${baccaratRounds.payout}),0)`,plays:sql<number>`count(*)`}).from(baccaratRounds).groupBy(baccaratRounds.userEmail),
    db.select({email:houseContributions.userEmail,total:sql<number>`coalesce(sum(${houseContributions.amount}),0)`}).from(houseContributions).groupBy(houseContributions.userEmail),
    db.select({email:users.chatgptEmail,slackName:users.slackName,house:users.house,pon:users.pon}).from(users).where(eq(users.status,"approved")),
    db.select({email:pointRequests.userEmail,value:sql<number>`count(*)`}).from(pointRequests).where(and(eq(pointRequests.status,"approved"),inArray(pointRequests.category,["lecturer","problem","useful_app","report_complete","exam_complete","answer_question","info","impression","post","reaction"]))).groupBy(pointRequests.userEmail),
  ]);
  const totals=new Map<string,Totals>();const get=(email:string)=>{const value=totals.get(email)??{spent:0,profit:0,donated:0,plays:0,jankenProfit:0,slotProfit:0,baccaratProfit:0,biggestPayout:0};totals.set(email,value);return value;};
  for(const [game,rows] of [["janken",janken],["slot",slot],["baccarat",baccarat]] as const)for(const row of rows){const value=get(row.email);const profit=Number(row.payout)-Number(row.spent);value.spent+=Number(row.spent);value.profit+=profit;value.plays+=Number(row.plays);value[`${game}Profit` as "jankenProfit"|"slotProfit"|"baccaratProfit"]+=profit;}
  for(const row of donations){const value=get(row.email);value.spent+=Number(row.total);value.donated+=Number(row.total);}
  const biggestRows=await db.select({email:slotSpins.userEmail,value:sql<number>`coalesce(max(${slotSpins.payout}),0)`}).from(slotSpins).groupBy(slotSpins.userEmail);for(const row of biggestRows)get(row.email).biggestPayout=Number(row.value);
  const names=new Map(people.map(person=>[person.email,person]));
  const rank=(key:keyof Totals,includeZero=false)=>[...totals.entries()].map(([email,value])=>({slackName:names.get(email)?.slackName??"名もなき学徒",house:names.get(email)?.house??null,value:value[key],plays:value.plays})).filter(item=>includeZero?item.plays>0:item.value>0).sort((a,b)=>b.value-a.value).slice(0,10);
  const wealth=people.map(person=>({slackName:person.slackName,house:person.house,value:Number(person.pon),plays:totals.get(person.email)?.plays??0})).filter(item=>item.value>0).sort((a,b)=>b.value-a.value).slice(0,10);
  const requestRanking=requests.map(row=>({slackName:names.get(row.email)?.slackName??"名もなき学徒",house:names.get(row.email)?.house??null,value:Number(row.value),plays:Number(row.value)})).filter(item=>item.value>0).sort((a,b)=>b.value-a.value).slice(0,10);
  return Response.json({spending:rank("spent"),gambling:rank("profit",true),donation:rank("donated"),plays:rank("plays"),janken:rank("jankenProfit",true),slot:rank("slotProfit",true),baccarat:rank("baccaratProfit",true),jackpot:rank("biggestPayout"),wealth,requests:requestRanking});
}

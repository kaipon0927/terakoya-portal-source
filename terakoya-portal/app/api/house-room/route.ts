import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateJsonMutation } from "../../api-security";
import { getDb } from "../../../db";
import { houseCommentReactions, houseCommentReports, houseComments, houseContributions, houseResults, pointRequests, users } from "../../../db/schema";

const houses = ["勇往邁進", "一期一会", "泰然自若", "幽玄無限", "魑魅魍魎"];
const levelThresholds = [0, 1000, 3000, 7000, 15000, 30000, 50000, 80000, 120000, 180000];
function growth(total:number){const level=Math.min(10,levelThresholds.filter(value=>total>=value).length);const floor=levelThresholds[level-1];const ceiling=level<10?levelThresholds[level]:floor;return{level,progress:level>=10?100:Math.round((total-floor)/(ceiling-floor)*100),next:level>=10?null:ceiling-total};}
function commentDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.now()-5*60*60*1000));}

export async function GET() {
  const identity = await getChatGPTUser();
  if (!identity) return Response.json({ error: "ログインが必要です" }, { status: 401 });

  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved") return Response.json({ error: "寺子屋参加の承認後に閲覧できます" }, { status: 403 });
  if (!profile.house) return Response.json({ error: "先に寮分け診断を受けてください" }, { status: 400 });

  const condition = and(eq(users.house, profile.house), eq(users.status, "approved"));
  const [summary] = await db.select({
    members: sql<number>`count(*)`,
    totalPon: sql<number>`coalesce(sum(${users.pon}), 0)`,
  }).from(users).where(condition);
  const gradeRows = await db.select({
    schoolYear: users.schoolYear,
    count: sql<number>`count(*)`,
  }).from(users).where(and(condition, eq(users.affiliation, "student"))).groupBy(users.schoolYear);
  const [staffSummary] = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(condition, eq(users.affiliation, "staff")));
  const houseMembers = await db.select({ slackName: users.slackName, schoolYear: users.schoolYear, affiliation: users.affiliation }).from(users).where(condition).orderBy(users.slackName);
  const allMembers = await db.select({ house: users.house, slackName: users.slackName, schoolYear: users.schoolYear, affiliation: users.affiliation }).from(users).where(and(eq(users.status, "approved"), sql`${users.house} is not null`)).orderBy(users.slackName);
  const houseCounts = await db.select({ house: users.house, count: sql<number>`count(*)` }).from(users).where(and(eq(users.status, "approved"), sql`${users.house} is not null`)).groupBy(users.house);
  const contributionRows = await db.select({ house: houseContributions.house, total: sql<number>`coalesce(sum(${houseContributions.amount}),0)` }).from(houseContributions).groupBy(houseContributions.house);
  const contributors = await db.select({slackName:users.slackName,total:sql<number>`coalesce(sum(${houseContributions.amount}),0)`,count:sql<number>`count(*)`}).from(houseContributions).leftJoin(users,eq(houseContributions.userEmail,users.chatgptEmail)).where(eq(houseContributions.house,profile.house)).groupBy(houseContributions.userEmail,users.slackName).orderBy(sql`sum(${houseContributions.amount}) desc`).limit(20);
  const [result] = await db.select().from(houseResults).where(eq(houseResults.userEmail, identity.email)).limit(1);
  const comments=await db.select({id:houseComments.id,slackName:houseComments.slackName,body:houseComments.body,createdAt:houseComments.createdAt}).from(houseComments).where(eq(houseComments.house,profile.house)).orderBy(desc(houseComments.id)).limit(100);
  const reactionRows=comments.length?await db.select({commentId:houseCommentReactions.commentId,userEmail:houseCommentReactions.userEmail,reaction:houseCommentReactions.reaction}).from(houseCommentReactions).where(inArray(houseCommentReactions.commentId,comments.map(comment=>comment.id))):[];
  const [{count:todayCount}]=await db.select({count:sql<number>`count(*)`}).from(houseComments).where(and(eq(houseComments.userEmail,identity.email),eq(houseComments.commentDate,commentDate())));

  return Response.json({
    house: profile.house,
    members: Number(summary?.members ?? 0),
    totalPon: Number(summary?.totalPon ?? 0),
    grades: Object.fromEntries(gradeRows.filter((row) => row.schoolYear).map((row) => [String(row.schoolYear), Number(row.count)])),
    staff: Number(staffSummary?.count ?? 0),
    houseMembers,
    houseRosters: Object.fromEntries(houses.map((house)=>[house,allMembers.filter(member=>member.house===house).map(({slackName,schoolYear,affiliation})=>({slackName,schoolYear,affiliation}))])),
    houseCounts: Object.fromEntries(houseCounts.map((row) => [String(row.house), Number(row.count)])),
    houseGrowth: Object.fromEntries(houses.map((house)=>{const total=Number(contributionRows.find(row=>row.house===house)?.total??0);return[house,{total,...growth(total)}];})),
    contributors:contributors.map(row=>({slackName:row.slackName??"名もなき寮生",total:Number(row.total),count:Number(row.count)})),
    scores: result?.scoresJson ? JSON.parse(result.scoresJson) : {},
    chimimoryoRate: Number(result?.chimimoryoRate ?? 0),
    comments:comments.map(comment=>({...comment,reactions:["👍","❤️","👏","🔥","📚"].map(reaction=>({reaction,count:reactionRows.filter(row=>row.commentId===comment.id&&row.reaction===reaction).length,mine:reactionRows.some(row=>row.commentId===comment.id&&row.reaction===reaction&&row.userEmail===identity.email)}))})),
    commentsRemaining: Math.max(0,10-Number(todayCount??0)),
  });
}

export async function POST(request:Request){
  const invalid=validateJsonMutation(request);if(invalid)return invalid;
  const identity=await getChatGPTUser();if(!identity)return Response.json({error:"ログインが必要です"},{status:401});
  const body=await request.json() as {amount?:number;comment?:string;reportCommentId?:number;reactionCommentId?:number;reaction?:string;reason?:string};
  const db=getDb();const [profile]=await db.select().from(users).where(eq(users.chatgptEmail,identity.email)).limit(1);
  if(Number.isInteger(body.reactionCommentId)){
    if(!profile||profile.status!=="approved"||!profile.house)return Response.json({error:"スタンプを押せません"},{status:403});
    const reaction=String(body.reaction??"");if(!["👍","❤️","👏","🔥","📚"].includes(reaction))return Response.json({error:"利用できないスタンプです"},{status:400});
    const commentId=Number(body.reactionCommentId);const [target]=await db.select({id:houseComments.id,house:houseComments.house}).from(houseComments).where(eq(houseComments.id,commentId)).limit(1);
    if(!target||target.house!==profile.house)return Response.json({error:"投稿が見つかりません"},{status:404});
    const [existing]=await db.select({id:houseCommentReactions.id}).from(houseCommentReactions).where(and(eq(houseCommentReactions.commentId,commentId),eq(houseCommentReactions.userEmail,identity.email),eq(houseCommentReactions.reaction,reaction))).limit(1);
    if(existing)await db.delete(houseCommentReactions).where(eq(houseCommentReactions.id,existing.id));else await db.insert(houseCommentReactions).values({commentId,userEmail:identity.email,reaction});
    return Response.json({ok:true,active:!existing});
  }
  if(Number.isInteger(body.reportCommentId)){
    if(!profile||profile.status!=="approved"||!profile.house)return Response.json({error:"通報できません"},{status:403});
    const [target]=await db.select({id:houseComments.id,house:houseComments.house,userEmail:houseComments.userEmail,slackName:houseComments.slackName,body:houseComments.body}).from(houseComments).where(eq(houseComments.id,Number(body.reportCommentId))).limit(1);
    if(!target||target.house!==profile.house)return Response.json({error:"投稿が見つかりません"},{status:404});
    const reason=(body.reason??"ルール違反の可能性").trim().slice(0,160)||"ルール違反の可能性";
    await db.insert(houseCommentReports).values({commentId:target.id,reporterEmail:identity.email,reporterSlackName:profile.slackName,reportedUserEmail:target.userEmail,reportedSlackName:target.slackName,house:target.house,bodySnapshot:target.body,reason}).onConflictDoNothing();
    return Response.json({ok:true});
  }
  if(typeof body.comment==="string"){
    if(!profile||profile.status!=="approved"||!profile.house)return Response.json({error:"組み分け後にコメントできます"},{status:403});
    const comment=body.comment.trim();if(!comment||comment.length>300)return Response.json({error:"コメントは1〜300文字で入力してください"},{status:400});
    const date=commentDate();
    const inserted=await env.DB.prepare("INSERT INTO house_comments (house,user_email,slack_name,body,comment_date) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM house_comments WHERE user_email=? AND comment_date=?) < 10").bind(profile.house,identity.email,profile.slackName,comment,date,identity.email,date).run();
    if(Number(inserted.meta.changes??0)===0)return Response.json({error:"今日の10回を使い切りました。午前5時に回復します"},{status:429});
    const [{count}]=await db.select({count:sql<number>`count(*)`}).from(houseComments).where(and(eq(houseComments.userEmail,identity.email),eq(houseComments.commentDate,date)));
    return Response.json({ok:true,remaining:Math.max(0,10-Number(count))});
  }
  const amount=Number(body.amount);
  if(![100,500,1000,5000].includes(amount))return Response.json({error:"奉納額を選んでください"},{status:400});
  if(!profile||profile.status!=="approved"||!profile.house)return Response.json({error:"組み分け後に奉納できます"},{status:403});
  if(profile.pon<amount)return Response.json({error:"奉納するPONが足りません"},{status:400});
  await db.batch([
    db.update(users).set({pon:sql`${users.pon} - ${amount}`}).where(and(eq(users.chatgptEmail,identity.email),sql`${users.pon} >= ${amount}`)),
    db.insert(houseContributions).values({userEmail:identity.email,house:profile.house,amount}),
    db.insert(pointRequests).values({userEmail:identity.email,category:"house_donation",amount:-amount,description:`${profile.house}寮へ奉納`,status:"approved",reviewedAt:new Date().toISOString()}),
  ]);
  const [{total}]=await db.select({total:sql<number>`coalesce(sum(${houseContributions.amount}),0)`}).from(houseContributions).where(eq(houseContributions.house,profile.house));
  const [updated]=await db.select({pon:users.pon}).from(users).where(eq(users.chatgptEmail,identity.email)).limit(1);
  return Response.json({ok:true,pon:updated.pon,total:Number(total),...growth(Number(total))});
}

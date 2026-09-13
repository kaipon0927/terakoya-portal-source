import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { courseName } from "../../courses";
import { validateJsonMutation } from "../../api-security";
import { hashJoinCode, normalizeJoinCode } from "../../join-code";
import { getDb } from "../../../db";
import { accessSettings, baccaratRounds, difficultyRatings, directMessages, gameSettings, gradeRatings, houseCommentReactions, houseCommentReports, houseComments, houseResults, jankenRounds, omikujiResults, pointRequests, slotSpins, users } from "../../../db/schema";

async function requireAdmin() {
  const identity = await getChatGPTUser();
  if (!identity) return null;
  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  return profile?.role === "admin" ? { identity, db } : null;
}

export async function GET() {
  const context = await requireAdmin();
  if (!context) return Response.json({ error: "総代専用です" }, { status: 403 });
  const pendingUsers = await context.db.select().from(users).where(eq(users.status, "pending"));
  const pendingPoints = await context.db.select({
    id: pointRequests.id,
    userEmail: pointRequests.userEmail,
    slackName: users.slackName,
    zenEmail: users.zenEmail,
    category: pointRequests.category,
    amount: pointRequests.amount,
    description: pointRequests.description,
    evidenceUrl: pointRequests.evidenceUrl,
    status: pointRequests.status,
    createdAt: pointRequests.createdAt,
    reviewedAt: pointRequests.reviewedAt,
  }).from(pointRequests).leftJoin(users,eq(pointRequests.userEmail,users.chatgptEmail)).where(eq(pointRequests.status, "pending"));
  const [stats] = await context.db.select({
    members: sql<number>`count(*)`,
    approved: sql<number>`sum(case when ${users.status} = 'approved' then 1 else 0 end)`,
    suspended: sql<number>`sum(case when ${users.status} = 'suspended' then 1 else 0 end)`,
    totalPon: sql<number>`coalesce(sum(case when ${users.status} = 'approved' then ${users.pon} else 0 end), 0)`,
  }).from(users);
  const [{ ratingCount }] = await context.db.select({ ratingCount: sql<number>`count(*)` }).from(difficultyRatings);
  const houseRows = await context.db.select({ house: users.house, members: sql<number>`count(*)`, pon: sql<number>`coalesce(sum(${users.pon}), 0)` }).from(users).where(eq(users.status, "approved")).groupBy(users.house);
  const members = await context.db.select({id:users.id,userEmail:users.chatgptEmail,slackName:users.slackName,zenEmail:users.zenEmail,schoolYear:users.schoolYear,affiliation:users.affiliation,house:users.house,diagnosedHouse:houseResults.house,sortingAnswersJson:houseResults.answersJson,pon:users.pon,status:users.status,role:users.role}).from(users).leftJoin(houseResults,eq(users.chatgptEmail,houseResults.userEmail)).where(inArray(users.status,["approved","suspended"]));
  const surveyRows=await context.db.select({
    courseId:difficultyRatings.courseId,
    academicYear:difficultyRatings.academicYear,
    quarter:difficultyRatings.quarter,
    respondentYear:sql<number>`coalesce(nullif(${difficultyRatings.respondentYear},0),${users.schoolYear},0)`,
    average:sql<number>`avg(${difficultyRatings.rating})`,
    count:sql<number>`count(*)`,
  }).from(difficultyRatings).leftJoin(users,eq(difficultyRatings.userEmail,users.chatgptEmail)).groupBy(difficultyRatings.courseId,difficultyRatings.academicYear,difficultyRatings.quarter,sql`coalesce(nullif(${difficultyRatings.respondentYear},0),${users.schoolYear},0)`);
  const surveyAnswerRows=await context.db.select({id:difficultyRatings.id,slackName:users.slackName,zenEmail:users.zenEmail,courseId:difficultyRatings.courseId,academicYear:difficultyRatings.academicYear,quarter:difficultyRatings.quarter,respondentYear:difficultyRatings.respondentYear,rating:difficultyRatings.rating,updatedAt:difficultyRatings.updatedAt}).from(difficultyRatings).leftJoin(users,eq(difficultyRatings.userEmail,users.chatgptEmail)).orderBy(desc(difficultyRatings.id));
  const gradeAnswerRows=await context.db.select({id:gradeRatings.id,slackName:users.slackName,zenEmail:users.zenEmail,courseId:gradeRatings.courseId,academicYear:gradeRatings.academicYear,quarter:gradeRatings.quarter,rating:gradeRatings.rating,updatedAt:gradeRatings.updatedAt}).from(gradeRatings).leftJoin(users,eq(gradeRatings.userEmail,users.chatgptEmail)).orderBy(desc(gradeRatings.id));
  const activeMembers=members.filter(member=>member.status==="approved");
  const sortedCount=activeMembers.filter(member=>member.house).length;
  const [gameSetting] = await context.db.select().from(gameSettings).where(eq(gameSettings.game, "janken")).limit(1);
  const [baccaratSetting] = await context.db.select().from(gameSettings).where(eq(gameSettings.game, "baccarat")).limit(1);
  const [gameStats] = await context.db.select({
    rounds: sql<number>`count(*)`,
    players: sql<number>`count(distinct ${jankenRounds.userEmail})`,
    winners: sql<number>`count(distinct case when ${jankenRounds.result} = 'win' then ${jankenRounds.userEmail} end)`,
    wins: sql<number>`sum(case when ${jankenRounds.result} = 'win' then 1 else 0 end)`,
    draws: sql<number>`sum(case when ${jankenRounds.result} = 'draw' then 1 else 0 end)`,
    losses: sql<number>`sum(case when ${jankenRounds.result} = 'lose' then 1 else 0 end)`,
    payout: sql<number>`coalesce(sum(${jankenRounds.payout}), 0)`,
  }).from(jankenRounds);
  const jankenPlayers = await context.db.select({
    userEmail:jankenRounds.userEmail, slackName:users.slackName, house:users.house,
    rounds:sql<number>`count(*)`, wins:sql<number>`sum(case when ${jankenRounds.result} = 'win' then 1 else 0 end)`,
    draws:sql<number>`sum(case when ${jankenRounds.result} = 'draw' then 1 else 0 end)`, losses:sql<number>`sum(case when ${jankenRounds.result} = 'lose' then 1 else 0 end)`,
    totalBet:sql<number>`coalesce(sum(${jankenRounds.wager}), 0)`, totalPayout:sql<number>`coalesce(sum(${jankenRounds.payout}), 0)`,
  }).from(jankenRounds).leftJoin(users,eq(jankenRounds.userEmail,users.chatgptEmail)).groupBy(jankenRounds.userEmail,users.slackName,users.house).orderBy(sql`sum(${jankenRounds.payout}) - sum(${jankenRounds.wager}) desc`);
  const jankenHistory = await context.db.select({id:jankenRounds.id,slackName:users.slackName,house:users.house,wager:jankenRounds.wager,payout:jankenRounds.payout,result:jankenRounds.result,playerHand:jankenRounds.playerHand,kaiponHand:jankenRounds.kaiponHand,createdAt:jankenRounds.createdAt}).from(jankenRounds).leftJoin(users,eq(jankenRounds.userEmail,users.chatgptEmail)).orderBy(desc(jankenRounds.id)).limit(500);
  const [baccaratStats]=await context.db.select({rounds:sql<number>`count(*)`,players:sql<number>`count(distinct ${baccaratRounds.userEmail})`,totalBet:sql<number>`coalesce(sum(${baccaratRounds.wager}),0)`,totalPayout:sql<number>`coalesce(sum(${baccaratRounds.payout}),0)`,playerWins:sql<number>`sum(case when ${baccaratRounds.winner}='player' then 1 else 0 end)`,bankerWins:sql<number>`sum(case when ${baccaratRounds.winner}='banker' then 1 else 0 end)`,ties:sql<number>`sum(case when ${baccaratRounds.winner}='tie' then 1 else 0 end)`}).from(baccaratRounds);
  const baccaratPlayers=await context.db.select({slackName:users.slackName,house:users.house,rounds:sql<number>`count(*)`,totalBet:sql<number>`coalesce(sum(${baccaratRounds.wager}),0)`,totalPayout:sql<number>`coalesce(sum(${baccaratRounds.payout}),0)`}).from(baccaratRounds).leftJoin(users,eq(baccaratRounds.userEmail,users.chatgptEmail)).groupBy(baccaratRounds.userEmail,users.slackName,users.house).orderBy(sql`sum(${baccaratRounds.payout})-sum(${baccaratRounds.wager}) desc`);
  const baccaratHistory=await context.db.select({id:baccaratRounds.id,slackName:users.slackName,house:baccaratRounds.house,wager:baccaratRounds.wager,betOn:baccaratRounds.betOn,winner:baccaratRounds.winner,payout:baccaratRounds.payout,playerScore:baccaratRounds.playerScore,bankerScore:baccaratRounds.bankerScore,createdAt:baccaratRounds.createdAt}).from(baccaratRounds).leftJoin(users,eq(baccaratRounds.userEmail,users.chatgptEmail)).orderBy(desc(baccaratRounds.id)).limit(500);
  const [slotStats] = await context.db.select({
    spins: sql<number>`count(*)`,
    players: sql<number>`count(distinct ${slotSpins.userEmail})`,
    winners: sql<number>`count(distinct case when ${slotSpins.payout} > 0 then ${slotSpins.userEmail} end)`,
    hits: sql<number>`sum(case when ${slotSpins.payout} > 0 then 1 else 0 end)`,
    totalBet: sql<number>`coalesce(sum(${slotSpins.wager}), 0)`,
    totalPayout: sql<number>`coalesce(sum(${slotSpins.payout}), 0)`,
    biggestPayout: sql<number>`coalesce(max(${slotSpins.payout}), 0)`,
  }).from(slotSpins);
  const slotWagers = await context.db.select({
    wager: slotSpins.wager,
    spins: sql<number>`count(*)`,
    hits: sql<number>`sum(case when ${slotSpins.payout} > 0 then 1 else 0 end)`,
    payout: sql<number>`coalesce(sum(${slotSpins.payout}), 0)`,
  }).from(slotSpins).groupBy(slotSpins.wager).orderBy(slotSpins.wager);
  const slotResults = await context.db.select({
    result: slotSpins.result,
    spins: sql<number>`count(*)`,
    payout: sql<number>`coalesce(sum(${slotSpins.payout}), 0)`,
  }).from(slotSpins).groupBy(slotSpins.result).orderBy(sql`count(*) desc`);
  const slotPlayers = await context.db.select({
    userEmail: slotSpins.userEmail,
    slackName: users.slackName,
    house: users.house,
    spins: sql<number>`count(*)`,
    totalBet: sql<number>`coalesce(sum(${slotSpins.wager}), 0)`,
    totalPayout: sql<number>`coalesce(sum(${slotSpins.payout}), 0)`,
    biggestPayout: sql<number>`coalesce(max(${slotSpins.payout}), 0)`,
    bestMultiplier: sql<number>`coalesce(max(cast(${slotSpins.payout} as real) / ${slotSpins.wager}), 0)`,
  }).from(slotSpins).leftJoin(users,eq(slotSpins.userEmail,users.chatgptEmail)).groupBy(slotSpins.userEmail,users.slackName,users.house).orderBy(sql`sum(${slotSpins.payout}) desc`);
  const slotHistory = await context.db.select({
    id: slotSpins.id,
    slackName: users.slackName,
    house: users.house,
    wager: slotSpins.wager,
    payout: slotSpins.payout,
    result: slotSpins.result,
    symbolsJson: slotSpins.symbolsJson,
    createdAt: slotSpins.createdAt,
  }).from(slotSpins).leftJoin(users,eq(slotSpins.userEmail,users.chatgptEmail)).orderBy(desc(slotSpins.id)).limit(500);
  const [joinCodeSetting] = await context.db.select().from(accessSettings).where(eq(accessSettings.key, "join_code")).limit(1);
  const dormComments=await context.db.select({id:houseComments.id,house:houseComments.house,slackName:houseComments.slackName,body:houseComments.body,createdAt:houseComments.createdAt,reportCount:sql<number>`(select count(*) from ${houseCommentReports} where ${houseCommentReports.commentId} = ${houseComments.id} and ${houseCommentReports.status} = 'pending')`}).from(houseComments).orderBy(desc(houseComments.id)).limit(500);
  const reportHistory=await context.db.select().from(houseCommentReports).orderBy(desc(houseCommentReports.id)).limit(500);
  const pointHistory=await context.db.select({id:pointRequests.id,slackName:users.slackName,zenEmail:users.zenEmail,category:pointRequests.category,amount:pointRequests.amount,description:pointRequests.description,status:pointRequests.status,createdAt:pointRequests.createdAt,reviewedAt:pointRequests.reviewedAt}).from(pointRequests).leftJoin(users,eq(pointRequests.userEmail,users.chatgptEmail)).orderBy(desc(pointRequests.id)).limit(500);
  const omikujiStats=await context.db.select({rank:omikujiResults.rank,count:sql<number>`count(*)`}).from(omikujiResults).groupBy(omikujiResults.rank);
  const omikujiHistory=await context.db.select({id:omikujiResults.id,slackName:users.slackName,house:users.house,fortuneDate:omikujiResults.fortuneDate,rank:omikujiResults.rank,createdAt:omikujiResults.createdAt}).from(omikujiResults).leftJoin(users,eq(omikujiResults.userEmail,users.chatgptEmail)).orderBy(desc(omikujiResults.id)).limit(500);
  return Response.json({
    pendingUsers,
    pendingPoints,
    stats: { members: Number(stats.members), approved: Number(stats.approved), suspended: Number(stats.suspended), totalPon: Number(stats.totalPon), ratingCount: Number(ratingCount), sorted:sortedCount, unsorted:activeMembers.length-sortedCount },
    houses: houseRows.map((row) => ({ house: row.house ?? "未所属", members: Number(row.members), pon: Number(row.pon) })),
    members: members.map(member=>({...member,sortingAnswers:member.sortingAnswersJson?JSON.parse(member.sortingAnswersJson) as number[]:null,sortingAnswersJson:undefined})),
    janken: {
      payouts: { 10: gameSetting?.payout10 ?? 30, 50: gameSetting?.payout50 ?? 150, 100: gameSetting?.payout100 ?? 300 },
      winChance: Math.max(1, Math.min(40, gameSetting?.winChance ?? 24)),
      drawChance: Math.max(0, Math.min(30, gameSetting?.drawChance ?? 12)),
      stats: { rounds: Number(gameStats.rounds), players: Number(gameStats.players), winners: Number(gameStats.winners), wins: Number(gameStats.wins ?? 0), draws: Number(gameStats.draws ?? 0), losses: Number(gameStats.losses ?? 0), payout: Number(gameStats.payout) },
      players:jankenPlayers.map(row=>({...row,slackName:row.slackName??"退会済みユーザー",rounds:Number(row.rounds),wins:Number(row.wins??0),draws:Number(row.draws??0),losses:Number(row.losses??0),totalBet:Number(row.totalBet),totalPayout:Number(row.totalPayout)})),
      history:jankenHistory.map(row=>({...row,slackName:row.slackName??"退会済みユーザー"})),
    },
    baccarat:{
      chances:{player:Math.max(1,Math.min(98,baccaratSetting?.winChance??45)),tie:Math.max(0,Math.min(30,baccaratSetting?.drawChance??10)),banker:Math.max(1,100-(baccaratSetting?.winChance??45)-(baccaratSetting?.drawChance??10))},
      stats:{rounds:Number(baccaratStats.rounds),players:Number(baccaratStats.players),totalBet:Number(baccaratStats.totalBet),totalPayout:Number(baccaratStats.totalPayout),playerWins:Number(baccaratStats.playerWins??0),bankerWins:Number(baccaratStats.bankerWins??0),ties:Number(baccaratStats.ties??0)},
      players:baccaratPlayers.map(row=>({...row,slackName:row.slackName??"退会済みユーザー",rounds:Number(row.rounds),totalBet:Number(row.totalBet),totalPayout:Number(row.totalPayout)})),
      history:baccaratHistory.map(row=>({...row,slackName:row.slackName??"退会済みユーザー"})),
    },
    slot: {
      stats: {
        spins: Number(slotStats.spins), players: Number(slotStats.players), winners: Number(slotStats.winners), hits: Number(slotStats.hits ?? 0),
        totalBet: Number(slotStats.totalBet), totalPayout: Number(slotStats.totalPayout), biggestPayout: Number(slotStats.biggestPayout),
      },
      wagers: slotWagers.map((row) => ({ wager: Number(row.wager), spins: Number(row.spins), hits: Number(row.hits ?? 0), payout: Number(row.payout) })),
      results: slotResults.map((row) => ({ result: row.result, spins: Number(row.spins), payout: Number(row.payout) })),
      players: slotPlayers.map((row) => ({ slackName: row.slackName ?? "退会済みユーザー", house: row.house, spins: Number(row.spins), totalBet: Number(row.totalBet), totalPayout: Number(row.totalPayout), biggestPayout: Number(row.biggestPayout), bestMultiplier: Number(row.bestMultiplier) })),
      history: slotHistory.map((row) => ({ id: row.id, slackName: row.slackName ?? "退会済みユーザー", house: row.house, wager: Number(row.wager), payout: Number(row.payout), result: row.result, symbols: JSON.parse(row.symbolsJson) as string[], createdAt: row.createdAt })),
    },
    joinCode: { enabled: Boolean(joinCodeSetting?.enabled), hint: joinCodeSetting?.codeHint ?? "" },
    survey:surveyRows.map(row=>({courseId:row.courseId,courseName:courseName(row.courseId),academicYear:Number(row.academicYear),quarter:Number(row.quarter),respondentYear:Number(row.respondentYear),average:Number(row.average),count:Number(row.count)})),
    surveyAnswers:surveyAnswerRows.map(row=>({...row,slackName:row.slackName??"退会済み",zenEmail:row.zenEmail??"",courseName:courseName(row.courseId),academicYear:Number(row.academicYear),quarter:Number(row.quarter),respondentYear:Number(row.respondentYear??0),rating:Number(row.rating)})),
    gradeAnswers:gradeAnswerRows.map(row=>({...row,slackName:row.slackName??"退会済み",zenEmail:row.zenEmail??"",courseName:courseName(row.courseId),academicYear:Number(row.academicYear),quarter:Number(row.quarter),rating:Number(row.rating)})),
    dormComments,
    reportHistory,
    pointHistory,
    omikuji:{stats:omikujiStats.map(row=>({rank:row.rank,count:Number(row.count)})),history:omikujiHistory.map(row=>({...row,slackName:row.slackName??"退会済み",house:row.house??"未診断"}))},
  });
}

export async function POST(request: Request) {
  const invalid = validateJsonMutation(request); if (invalid) return invalid;
  const context = await requireAdmin();
  if (!context) return Response.json({ error: "総代専用です" }, { status: 403 });
  const body = (await request.json()) as { kind?: string; id?: number; ids?: number[]; userIds?: number[]; action?: string; category?: string; description?: string; message?: string; slackName?: string; payouts?: Record<string, number>; winChance?: number; drawChance?: number; playerChance?: number; bankerChance?: number; tieChance?: number; code?: string; house?: string };
  if(body.kind==="slack_name"){
    if(!body.id)return Response.json({error:"変更する参加者を選んでください"},{status:400});
    const slackName=(body.slackName??"").trim().replace(/\s+/g," ");
    if(slackName.length<1||slackName.length>40)return Response.json({error:"Slack名は1〜40文字で入力してください"},{status:400});
    const [target]=await context.db.select({email:users.chatgptEmail,oldName:users.slackName}).from(users).where(eq(users.id,body.id)).limit(1);
    if(!target)return Response.json({error:"参加者が見つかりません"},{status:404});
    await context.db.batch([
      context.db.update(users).set({slackName}).where(eq(users.id,body.id)),
      context.db.update(houseComments).set({slackName}).where(eq(houseComments.userEmail,target.email)),
      context.db.update(houseCommentReports).set({reporterSlackName:slackName}).where(eq(houseCommentReports.reporterEmail,target.email)),
      context.db.update(houseCommentReports).set({reportedSlackName:slackName}).where(eq(houseCommentReports.reportedUserEmail,target.email)),
    ]);
    return Response.json({ok:true,slackName,oldName:target.oldName});
  }
  if(body.kind==="direct_message"){
    if(!body.id)return Response.json({error:"送信先を選んでください"},{status:400});
    const message=(body.message??"").trim();
    if(!message||message.length>1000)return Response.json({error:"メッセージは1〜1000文字で入力してください"},{status:400});
    const [target]=await context.db.select({email:users.chatgptEmail}).from(users).where(eq(users.id,body.id)).limit(1);
    if(!target)return Response.json({error:"参加者が見つかりません"},{status:404});
    await context.db.insert(directMessages).values({recipientEmail:target.email,body:message});
    return Response.json({ok:true});
  }
  if (body.kind === "join_code") {
    if (body.action === "disable") {
      const [setting] = await context.db.select().from(accessSettings).where(eq(accessSettings.key, "join_code")).limit(1);
      if (setting) await context.db.update(accessSettings).set({ enabled: 0, updatedAt: new Date().toISOString() }).where(eq(accessSettings.key, "join_code"));
      return Response.json({ ok: true, enabled: false });
    }
    const code = normalizeJoinCode(body.code ?? "");
    if (code.length < 8 || code.length > 48) return Response.json({ error: "入学コードは8〜48文字で設定してください" }, { status: 400 });
    const codeHash = await hashJoinCode(code);
    const codeHint = code.length <= 4 ? "設定済み" : `${code.slice(0, 2)}••••${code.slice(-2)}`;
    await context.db.insert(accessSettings).values({ key: "join_code", codeHash, codeHint, enabled: 1 }).onConflictDoUpdate({ target: accessSettings.key, set: { codeHash, codeHint, enabled: 1, updatedAt: new Date().toISOString() } });
    return Response.json({ ok: true, enabled: true, hint: codeHint });
  }
  if (body.kind === "janken_settings") {
    const payout10 = Number(body.payouts?.["10"]);
    const payout50 = Number(body.payouts?.["50"]);
    const payout100 = Number(body.payouts?.["100"]);
    const winChance = Number(body.winChance);
    const drawChance = Number(body.drawChance);
    if (![payout10,payout50,payout100,winChance,drawChance].every(Number.isInteger)||payout10<10||payout10>100||payout50<50||payout50>500||payout100<100||payout100>1000||winChance<1||winChance>40||drawChance<0||drawChance>30||winChance+drawChance>70) return Response.json({ error: "払戻額・勝率・あいこ率の設定範囲を確認してください" }, { status: 400 });
    await context.db.insert(gameSettings).values({ game: "janken", payout10,payout50,payout100,winChance,drawChance }).onConflictDoUpdate({ target: gameSettings.game, set: { payout10,payout50,payout100,winChance,drawChance, updatedAt: new Date().toISOString() } });
    return Response.json({ ok: true, payouts:{10:payout10,50:payout50,100:payout100},winChance,drawChance });
  }
  if(body.kind==="baccarat_settings"){
    const playerChance=Number(body.playerChance),bankerChance=Number(body.bankerChance),tieChance=Number(body.tieChance);
    if(![playerChance,bankerChance,tieChance].every(Number.isInteger)||playerChance<1||bankerChance<1||tieChance<0||tieChance>30||playerChance+bankerChance+tieChance!==100)return Response.json({error:"3つの確率を合計100%にしてください（引き分けは0〜30%）"},{status:400});
    await context.db.insert(gameSettings).values({game:"baccarat",winChance:playerChance,drawChance:tieChance}).onConflictDoUpdate({target:gameSettings.game,set:{winChance:playerChance,drawChance:tieChance,updatedAt:new Date().toISOString()}});
    return Response.json({ok:true,chances:{player:playerChance,banker:bankerChance,tie:tieChance}});
  }
  if(body.kind==="house_comment"){
    if(!body.id)return Response.json({error:"削除するコメントを選んでください"},{status:400});
    await context.db.delete(houseCommentReactions).where(eq(houseCommentReactions.commentId,body.id));
    await context.db.delete(houseComments).where(eq(houseComments.id,body.id));
    return Response.json({ok:true});
  }
  if(body.kind==="report_review"){
    if(!body.id)return Response.json({error:"確認する通報を選んでください"},{status:400});
    await context.db.update(houseCommentReports).set({status:"reviewed"}).where(eq(houseCommentReports.id,body.id));
    return Response.json({ok:true});
  }
  if (body.kind === "user_batch") {
    const ids = [...new Set((body.ids ?? []).filter(Number.isInteger))].slice(0, 500);
    if (!ids.length || !["approve", "reject"].includes(body.action ?? "")) return Response.json({ error: "対象と操作を選んでください" }, { status: 400 });
    const nextStatus = body.action === "approve" ? "approved" : "rejected";
    const targets = await context.db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.status, "pending"), eq(users.role, "member")));
    if (targets.length) await context.db.update(users).set({ status: nextStatus }).where(inArray(users.id, targets.map((target) => target.id)));
    return Response.json({ ok: true, reviewed: targets.length });
  }
  if (body.kind === "point_batch") {
    const ids = [...new Set((body.ids ?? []).filter(Number.isInteger))].slice(0, 200);
    if (!ids.length || !["approve", "reject"].includes(body.action ?? "")) return Response.json({ error: "対象と操作を選んでください" }, { status: 400 });
    const pending = await context.db.select().from(pointRequests).where(and(inArray(pointRequests.id, ids), eq(pointRequests.status, "pending")));
    let reviewed = 0;
    for (const point of pending) {
      let amount = point.amount;
      if (body.action === "approve" && point.category === "problem") {
        const [{ count }] = await context.db.select({ count: sql<number>`count(*)` }).from(pointRequests).where(and(eq(pointRequests.userEmail, point.userEmail), eq(pointRequests.category, "problem"), eq(pointRequests.status, "approved")));
        if (Number(count) === 0) amount += 2000;
      }
      await context.db.batch([
        context.db.update(pointRequests).set({ status: body.action === "approve" ? "approved" : "rejected", amount, reviewedAt: new Date().toISOString() }).where(and(eq(pointRequests.id, point.id), eq(pointRequests.status, "pending"))),
        ...(body.action === "approve" ? [context.db.update(users).set({ pon: sql`${users.pon} + ${amount}` }).where(eq(users.chatgptEmail, point.userEmail))] : []),
      ]);
      reviewed += 1;
    }
    return Response.json({ ok: true, reviewed });
  }
  if (body.kind === "batch_grant") {
    const amounts: Record<string, number> = { lecturer:10000, problem:5000, useful_app:3000, report_complete:1000, exam_complete:1000, study_session:1000, huddle:700, answer_question:700, info:500, impression:300, post:50, reaction:30 };
    const category = body.category ?? "";
    const labels:Record<string,string>={lecturer:"勉強会の講師",problem:"問題共有",useful_app:"履修に役立つアプリ共有",report_complete:"レポート全部提出",exam_complete:"試験受験",study_session:"勉強会参加",huddle:"ハドル参加",answer_question:"質問に回答",info:"情報共有",impression:"感想共有",post:"ルールに沿った書き込み",reaction:"スタンプ"};
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    const description = body.description?.trim().slice(0, 160) || `${labels[category]??"活動"}・総代付与・${today}`;
    const userIds = [...new Set((body.userIds ?? []).filter(Number.isInteger))].slice(0, 500);
    if (!amounts[category] || !userIds.length) return Response.json({ error: "活動と対象者を選んでください" }, { status: 400 });
    const selected = await context.db.select().from(users).where(and(inArray(users.id, userIds), eq(users.status, "approved")));
    const alreadyGranted = await context.db.select({ userEmail: pointRequests.userEmail }).from(pointRequests).where(and(eq(pointRequests.category, category), eq(pointRequests.description, description), eq(pointRequests.status, "approved")));
    const grantedEmails = new Set(alreadyGranted.map((row) => row.userEmail));
    const eligible = selected.filter((member) => !grantedEmails.has(member.chatgptEmail));
    if (eligible.length) {
      await context.db.batch(eligible.flatMap((member) => [
        context.db.insert(pointRequests).values({ userEmail: member.chatgptEmail, category, amount: amounts[category], description, status: "approved", reviewedAt: new Date().toISOString() }),
        context.db.update(users).set({ pon: sql`${users.pon} + ${amounts[category]}` }).where(eq(users.id, member.id)),
      ]));
    }
    return Response.json({ ok: true, awarded: eligible.length, skipped: selected.length - eligible.length });
  }
  if (!body.id) return Response.json({ error: "操作が不正です" }, { status: 400 });
  if (body.kind === "house") {
    const allowedHouses = ["勇往邁進", "一期一会", "泰然自若", "幽玄無限", "魑魅魍魎"];
    const [target] = await context.db.select({ id: users.id, diagnosedHouse: houseResults.house }).from(users).leftJoin(houseResults,eq(users.chatgptEmail,houseResults.userEmail)).where(eq(users.id, body.id)).limit(1);
    if (!target) return Response.json({ error: "参加者が見つかりません" }, { status: 404 });
    const nextHouse = body.action === "restore" ? target.diagnosedHouse : body.house;
    if (!nextHouse || !allowedHouses.includes(nextHouse)) return Response.json({ error: "戻せる診断結果がありません" }, { status: 400 });
    await context.db.update(users).set({ house: nextHouse }).where(eq(users.id, body.id));
    return Response.json({ ok: true, house: nextHouse });
  }
  if (body.kind === "user") {
    if (!["approve", "reject", "suspend", "restore"].includes(body.action ?? "")) return Response.json({ error: "操作が不正です" }, { status: 400 });
    const [target] = await context.db.select().from(users).where(eq(users.id, body.id)).limit(1);
    if (!target) return Response.json({ error: "参加者が見つかりません" }, { status: 404 });
    if (target.role === "admin") return Response.json({ error: "総代の利用状態は変更できません" }, { status: 400 });
    const nextStatus = body.action === "approve" || body.action === "restore" ? "approved" : body.action === "suspend" ? "suspended" : "rejected";
    await context.db.update(users).set({ status: nextStatus }).where(eq(users.id, body.id));
  } else if (body.kind === "point") {
    if (!["approve", "reject"].includes(body.action ?? "")) return Response.json({ error: "操作が不正です" }, { status: 400 });
    const [point] = await context.db.select().from(pointRequests).where(and(eq(pointRequests.id, body.id), eq(pointRequests.status, "pending"))).limit(1);
    if (!point) return Response.json({ error: "申請がありません" }, { status: 404 });
    let amount = point.amount;
    if (body.action === "approve" && point.category === "problem") {
      const [{ count }] = await context.db.select({ count: sql<number>`count(*)` }).from(pointRequests).where(and(eq(pointRequests.userEmail, point.userEmail), eq(pointRequests.category, "problem"), eq(pointRequests.status, "approved")));
      if (Number(count) === 0) amount += 2000;
    }
    await context.db.batch([
      context.db.update(pointRequests).set({ status: body.action === "approve" ? "approved" : "rejected", amount, reviewedAt: new Date().toISOString() }).where(eq(pointRequests.id, body.id)),
      ...(body.action === "approve" ? [context.db.update(users).set({ pon: sql`${users.pon} + ${amount}` }).where(eq(users.chatgptEmail, point.userEmail))] : []),
    ]);
  }
  return Response.json({ ok: true });
}

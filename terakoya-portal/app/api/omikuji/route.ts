import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { omikujiResults, users } from "../../../db/schema";

type Fortune = {
  rank: string;
  overall: string;
  academic: { stars: number; text: string };
  social: { stars: number; text: string };
  romance: { stars: number; text: string };
  pon: { stars: number; text: string };
  advice: string;
  luckyColor: string;
  luckyItem: string;
};

const ranks = [
  { name: "極楽", weight: 2, base: 5 }, { name: "大吉", weight: 120, base: 5 },
  { name: "吉", weight: 200, base: 4 }, { name: "中吉", weight: 220, base: 4 },
  { name: "小吉", weight: 180, base: 3 }, { name: "末吉", weight: 150, base: 3 },
  { name: "凶", weight: 80, base: 2 }, { name: "大凶", weight: 46, base: 1 },
  { name: "地獄", weight: 2, base: 1 },
];

const overall: Record<string, string[]> = {
  "極楽": ["今日は何をしても妙に話が早い。徳を積んだ記憶がなくても、ありがたく受け取れ。", "追い風どころか柴犬が神輿で運んでくれる日。調子に乗るなら今日にしろ。"],
  "大吉": ["運はかなり味方している。遠慮して黙ると、せっかくの幸運までROM専になる。", "思ったよりうまくいく日。疑って二度見している暇に一歩進め。", "今日は行動した者勝ち。完璧を待つと日付だけが変わる。"],
  "吉": ["地味によい。派手な奇跡はないが、締切には間に合う。十分ありがたい。", "小さく動けば小さく報われる。ゼロ投稿で大反響だけは無理だ。", "普段どおりが一番強い日。急に別人格を始めなければ安泰。"],
  "中吉": ["悪くない。ただし自信と勢いを混同すると、あとで自分の投稿を見返せなくなる。", "半歩先までは見えている。十歩先を妄想する前に、目の前を片づけよう。", "ほどほどに恵まれる日。欲張ると全部『あとでやる』になる。"],
  "小吉": ["小さな幸運は来る。通知を全部ミュートしていると、そのまま通り過ぎる。", "期待値を上げすぎなければよい日。ハードルは床に置いて進め。", "今日は六割で出す勇気が吉。推敲だけで夜を迎えるな。"],
  "末吉": ["今は結果が見えにくいだけ。焦って謎の長文を投下すると、さらに見えなくなる。", "遅れて効いてくる運勢。既読がつかなくても追撃は一度まで。", "地味な積み重ねが後日回収される。今日は映えないが、人生は毎日表紙ではない。"],
  "凶": ["空回り注意。今日は熱意より送信前の三秒があなたを救う。", "思いつきで動くと、明日の自分が謝罪担当になる。いったん茶を飲め。", "無理に目立つと裏目に出る日。静かにしているだけで評価が上がることもある。"],
  "大凶": ["今日は決断を急ぐな。あなたの勢いに、運がまだログインできていない。", "だいたい裏目。重要なDMは下書きに寝かせ、本人も早く寝ろ。", "自信満々のときほど確認せよ。誤字より怖いのは、誤字のまま思想を語ることだ。"],
  "地獄": ["本日は運勢がメンテナンス中。何か成し遂げるより、被害を増やさず帰還せよ。", "柴犬も目をそらした。大事な決断・レスバ・深夜DMは禁止。寝れば明日は別の日だ。"],
};

const categoryTexts: Record<string, Record<number, string[]>> = {
  academic: {
    1:["読んでも頭を素通りする。今日は量より一問を丁寧に。","課題を開いた時点で半分勝ち。残り半分は開いたまま寝ないこと。","知識が霧の中。新規より復習に逃げるのが正解。"],
    2:["集中力が短い。25分だけなら柴犬も見張ってくれる。","難問に粘るより、取れる点を拾え。プライドは単位にならない。","分かった気になる日。説明できるか試すと現実が見える。"],
    3:["普通にやれば普通に進む。奇跡待ちより着手が早い。","一人で詰まる前に質問せよ。沈黙は知性ではなく未提出になる。","復習がよく効く。新しい教材を買う前に、今ある資料を開け。"],
    4:["理解がつながりやすい日。長文ノートより要点三つで勝てる。","人に教えると定着する。ただし講義を始める前に相手の了承を取れ。","苦手科目に手を出す好機。今日のあなたなら逃げ足より理解が速い。"],
    5:["頭が冴えている。先延ばしの言い訳まで論破できる。","難問が面白く見える日。勢いのまま一科目片づけろ。","学びがよく入る。スクショだけ集めず、自分の頭にも保存せよ。"],
  },
  social: {
    1:["言葉が強くなりやすい。正論でも角が立てば、刺さるのは相手だ。","返信の温度差に勝手な物語を作るな。相手はただ風呂かもしれない。","今日は聞き役が吉。沈黙を埋めるための自分語りは長くなる。"],
    2:["話しかける相手を選べ。全員と仲良くしようとすると全員に疲れる。","スタンプ一つで十分な場面がある。長文は親切の着ぐるみを着た圧になる。","反応が薄くても追撃しない。通信障害より人間関係の障害が怖い。"],
    3:["挨拶と一言で流れが変わる。壮大な自己紹介は不要。","ほどよい距離感が正解。近づきすぎず、消えすぎず。","小さな返信が縁を作る。見る専の殻から前足だけ出してみよう。"],
    4:["気の合う人と話が弾む。勢いで朝までハドルしない限り吉。","相談に乗ると信頼が育つ。解決より、まず最後まで聞け。","イベント参加が縁につながる。聞き専でも存在はちゃんと伝わる。"],
    5:["人との縁が強い日。気になる場には自分から顔を出せ。","あなたの一言が場を動かす。今日は空振りを恐れなくていい。","よい仲間が見つかる。スタンプだけで終わらず一言返すとさらに吉。"],
  },
  romance: {
    1:["深夜の長文DMは禁止。朝読む相手の身にもなれ。","脈を読むより空気を読め。今日は押すほど扉が重くなる。","寂しさを好意と誤認しやすい。まず寝て、それでも好きなら考えよう。"],
    2:["連絡頻度で愛情を測ると電池が減る。自分の時間も充電せよ。","匂わせは伝わらない。だが直球すぎる告白も今日は待て。","返信が遅いだけで闇投稿しない。観客は事情を知らない。"],
    3:["自然体が一番。盛ったプロフィールは後で自分が回収する。","恋バナは楽しいが、本人の許可なく議事録を共有するな。","焦らなければ平穏。運命の人も毎日Slackを見ているとは限らない。"],
    4:["気になる人への軽い一言が吉。最初から人生設計を送るな。","会話が進みやすい日。質問攻めではなく、自分の話も少しだけ。","リアルイベントに縁あり。服より先に集合時間を確認せよ。"],
    5:["恋の追い風あり。素直さは強いが、連投は素直さではない。","距離を縮める好機。勇気を出して、まず普通の会話から。","魅力が伝わりやすい日。作った人格より、機嫌のよい自分で行け。"],
  },
  pon: {
    1:["賭け事は休め。今日の運はPONを見ると逃げる。","申請内容の確認を。証拠リンクなしで総代の超能力に期待するな。","増やすより守る日。スロット実装前から負ける顔をするな。"],
    2:["小さな出費に注意。十回の『少しだけ』は少しではない。","共有するなら中身を確認。量産された薄い情報は柴犬も読まない。","今日はPONより信用を貯めろ。後から利息のように効いてくる。"],
    3:["地道な共有が吉。派手さより、誰か一人を助ける情報を。","残高は平穏。増えないからと謎の賭けに走らなければ安泰。","申請忘れに注意。善行も記録しなければ総代には見えない。"],
    4:["役立つ情報が見つかりそう。出し惜しみせず共有すると巡ってくる。","PON運は上向き。講師までは無理でも、丁寧な感想なら今日できる。","人を助けた分が返りやすい日。ただし見返りを顔に書くな。"],
    5:["大きく稼ぐ好機。得意分野の講師をすると一気に一万PONだ。","良質な問題共有に縁あり。確認してから出せば英雄、未確認なら事件。","あなたの知識が価値になる日。黙って抱えるより、整えて分けよう。"],
  },
};

const advice = ["通知を閉じて、まず一つ終わらせよ。", "返信の前に水を一杯飲め。", "完璧より提出。これは何度言っても効く。", "誰かに期待する前に、自分が一度動け。", "今日は追撃DMを一回我慢せよ。", "分からないことを分からないと言える者が強い。", "勢いは武器だが、安全装置も付けておけ。", "孤独と静けさは似ているが、同じではない。", "休むのも予定に入れないと、永遠に延期される。", "スタンプだけでも感謝は示せる。無反応より百倍よい。", "自分のTimesに書く前に、未来の自分が読めるか考えよ。", "その正論、今ここで言う必要があるかだけ確認せよ。", "一人で抱える美学より、早めの相談が単位を救う。", "運命を待つな。だが相手の都合は待て。", "今日は小さく始めて、調子が出たら続ければよい。", "柴犬は見ている。総代もたぶん見ている。" ];
const colors = ["苔緑", "藤色", "朱色", "山吹色", "藍色", "桜色", "竹色", "生成り", "葡萄色", "空色"];
const items = ["温かいお茶", "赤い付箋", "犬のスタンプ", "小さなノート", "竹柄の小物", "お気に入りのペン", "座布団", "甘いもの", "イヤホン", "目覚まし時計"];

function randomInt(max: number) { const values = new Uint32Array(1); crypto.getRandomValues(values); return values[0] % max; }
function pick<T>(items: T[]) { return items[randomInt(items.length)]; }
function fortuneDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() - 5 * 60 * 60 * 1000)); }
function pickRank() { const roll = randomInt(1000); let cursor = 0; for (const rank of ranks) { cursor += rank.weight; if (roll < cursor) return rank; } return ranks[5]; }
function dimension(base: number, category: string) { const stars = Math.max(1, Math.min(5, base + [-1,0,0,0,1][randomInt(5)])); return { stars, text: pick(categoryTexts[category][stars]) }; }
function createFortune(): Fortune { const rank = pickRank(); return { rank: rank.name, overall: pick(overall[rank.name]), academic: dimension(rank.base, "academic"), social: dimension(rank.base, "social"), romance: dimension(rank.base, "romance"), pon: dimension(rank.base, "pon"), advice: pick(advice), luckyColor: pick(colors), luckyItem: pick(items) }; }

async function getViewer() {
  const identity = await getChatGPTUser();
  if (!identity) return { error: Response.json({ error: "ログインが必要です" }, { status: 401 }) };
  const db = getDb();
  const [profile] = await db.select().from(users).where(eq(users.chatgptEmail, identity.email)).limit(1);
  if (!profile || profile.status !== "approved") return { error: Response.json({ error: "寺子屋参加の承認後に引けます" }, { status: 403 }) };
  if (!profile.house) return { error: Response.json({ error: "先に寮診断を受けてください" }, { status: 403 }) };
  return { identity, db };
}

export async function GET() {
  const viewer = await getViewer(); if ("error" in viewer) return viewer.error;
  const date = fortuneDate();
  const [row] = await viewer.db.select().from(omikujiResults).where(and(eq(omikujiResults.userEmail, viewer.identity.email), eq(omikujiResults.fortuneDate, date))).limit(1);
  return Response.json({ date, result: row ? JSON.parse(row.resultJson) as Fortune : null });
}

export async function POST() {
  const viewer = await getViewer(); if ("error" in viewer) return viewer.error;
  const date = fortuneDate();
  const [existing] = await viewer.db.select().from(omikujiResults).where(and(eq(omikujiResults.userEmail, viewer.identity.email), eq(omikujiResults.fortuneDate, date))).limit(1);
  if (existing) return Response.json({ date, result: JSON.parse(existing.resultJson) as Fortune });
  const result = createFortune();
  await viewer.db.insert(omikujiResults).values({ userEmail: viewer.identity.email, fortuneDate: date, rank: result.rank, resultJson: JSON.stringify(result) }).onConflictDoNothing();
  const [saved] = await viewer.db.select().from(omikujiResults).where(and(eq(omikujiResults.userEmail, viewer.identity.email), eq(omikujiResults.fortuneDate, date))).limit(1);
  return Response.json({ date, result: saved ? JSON.parse(saved.resultJson) as Fortune : result });
}

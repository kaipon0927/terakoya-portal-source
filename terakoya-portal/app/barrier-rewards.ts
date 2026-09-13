import { env } from "cloudflare:workers";

const EVENT_KEY = "barrier_rakutanju_2026_final_v1";
const EVENT_END_DB = "2026-08-31 14:59:59";

const finalRewards: Record<string, { rank: number; participant: number; nonparticipant: number }> = {
  "勇往邁進": { rank: 1, participant: 10000, nonparticipant: 3000 },
  "泰然自若": { rank: 2, participant: 5000, nonparticipant: 1500 },
  "幽玄無限": { rank: 3, participant: 3000, nonparticipant: 1000 },
  "魑魅魍魎": { rank: 4, participant: 2000, nonparticipant: 700 },
  "一期一会": { rank: 5, participant: 1000, nonparticipant: 300 },
};

type EligibleMember = {
  chatgpt_email: string;
  house: string;
  participated: number;
};

/** Applies the finished event's rewards once for the whole site. */
export async function ensureBarrierFinalRewards() {
  const marker = await env.DB.prepare(
    "INSERT OR IGNORE INTO access_settings (key, code_hash, code_hint, enabled) VALUES (?, 'one-time-grant', '大妖怪落単呪・最終順位報酬付与済み', 0)",
  ).bind(EVENT_KEY).run();
  if (Number(marker.meta.changes ?? 0) === 0) return false;

  try {
    const result = await env.DB.prepare(
      `SELECT u.chatgpt_email, u.house,
        CASE WHEN EXISTS (
          SELECT 1 FROM barrier_battle_attempts b WHERE b.user_email = u.chatgpt_email
        ) THEN 1 ELSE 0 END AS participated
       FROM users u
       WHERE u.status = 'approved'
         AND u.created_at <= ?
         AND u.house IN ('勇往邁進', '一期一会', '泰然自若', '幽玄無限', '魑魅魍魎')
       ORDER BY u.id`,
    ).bind(EVENT_END_DB).all<EligibleMember>();

    const now = new Date().toISOString();
    const statements = result.results.flatMap((member) => {
      const reward = finalRewards[member.house];
      const participated = Number(member.participated) === 1;
      const amount = participated ? reward.participant : reward.nonparticipant;
      const participationLabel = participated ? "参加者報酬" : "寮所属者報酬";
      const description = `大妖怪「落単呪」・${member.house} ${reward.rank}位・${participationLabel}`;
      return [
        env.DB.prepare(
          "INSERT INTO point_requests (user_email, category, amount, description, evidence_url, status, reviewed_at) VALUES (?, 'barrier_reward', ?, ?, '', 'approved', ?)",
        ).bind(member.chatgpt_email, amount, description, now),
        env.DB.prepare("UPDATE users SET pon = pon + ? WHERE chatgpt_email = ? AND status = 'approved'").bind(amount, member.chatgpt_email),
      ];
    });

    if (statements.length) await env.DB.batch(statements);
    return true;
  } catch (error) {
    // The reward batch is transactional. Removing the marker permits a clean retry.
    await env.DB.prepare("DELETE FROM access_settings WHERE key = ?").bind(EVENT_KEY).run();
    throw error;
  }
}

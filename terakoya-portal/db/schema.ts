import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatgptEmail: text("chatgpt_email").notNull().unique(),
  zenEmail: text("zen_email").notNull(),
  slackName: text("slack_name").notNull(),
  schoolYear: integer("school_year"),
  affiliation: text("affiliation").notNull().default("student"),
  zodiacSign: text("zodiac_sign"),
  status: text("status").notNull().default("pending"),
  role: text("role").notNull().default("member"),
  house: text("house"),
  avatarStyle: integer("avatar_style").notNull().default(0),
  avatarAccent: text("avatar_accent").notNull().default("vermilion"),
  pon: integer("pon").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const difficultyRatings = sqliteTable(
  "difficulty_ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    courseId: text("course_id").notNull(),
    rating: integer("rating").notNull(),
    academicYear: integer("academic_year").notNull().default(2026),
    quarter: integer("quarter").notNull().default(2),
    respondentYear: integer("respondent_year").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("difficulty_user_course_period_idx").on(table.userEmail, table.courseId, table.academicYear, table.quarter)],
);

export const gradeRatings = sqliteTable(
  "grade_ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    courseId: text("course_id").notNull(),
    rating: integer("rating").notNull(),
    academicYear: integer("academic_year").notNull().default(2026),
    quarter: integer("quarter").notNull().default(2),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("grade_user_course_period_idx").on(table.userEmail, table.courseId, table.academicYear, table.quarter)],
);

export const pointRequests = sqliteTable("point_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  description: text("description").notNull().default(""),
  evidenceUrl: text("evidence_url").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
});

export const dailyLoginRewards = sqliteTable(
  "daily_login_rewards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    rewardDate: text("reward_date").notNull(),
    amount: integer("amount").notNull().default(10),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("daily_login_user_date_idx").on(table.userEmail, table.rewardDate)],
);

export const omikujiResults = sqliteTable(
  "omikuji_results",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    fortuneDate: text("fortune_date").notNull(),
    rank: text("rank").notNull(),
    resultJson: text("result_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("omikuji_user_date_idx").on(table.userEmail, table.fortuneDate)],
);

export const houseResults = sqliteTable("house_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull().unique(),
  house: text("house").notNull(),
  scoresJson: text("scores_json").notNull(),
  answersJson: text("answers_json"),
  chimimoryoRate: integer("chimimoryo_rate").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const houseContributions = sqliteTable("house_contributions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  house: text("house").notNull(),
  amount: integer("amount").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sortingBonusAwards = sqliteTable(
  "sorting_bonus_awards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    amount: integer("amount").notNull().default(300),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("sorting_bonus_user_idx").on(table.userEmail)],
);

export const surveyBonusAwards = sqliteTable(
  "survey_bonus_awards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    amount: integer("amount").notNull().default(500),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("survey_bonus_user_idx").on(table.userEmail)],
);

export const gameSettings = sqliteTable("game_settings", {
  game: text("game").primaryKey(),
  multiplier10: integer("multiplier_10").notNull().default(3),
  multiplier50: integer("multiplier_50").notNull().default(2),
  multiplier100: integer("multiplier_100").notNull().default(3),
  payout10: integer("payout_10").notNull().default(30),
  payout50: integer("payout_50").notNull().default(150),
  payout100: integer("payout_100").notNull().default(300),
  winChance: integer("win_chance").notNull().default(18),
  drawChance: integer("draw_chance").notNull().default(12),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jankenRounds = sqliteTable("janken_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  wager: integer("wager").notNull(),
  payout: integer("payout").notNull().default(0),
  result: text("result").notNull(),
  playerHand: text("player_hand").notNull(),
  kaiponHand: text("kaipon_hand").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const baccaratRounds = sqliteTable("baccarat_rounds", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  house: text("house").notNull(),
  wager: integer("wager").notNull(),
  betOn: text("bet_on").notNull(),
  winner: text("winner").notNull(),
  payout: integer("payout").notNull().default(0),
  playerCardsJson: text("player_cards_json").notNull(),
  bankerCardsJson: text("banker_cards_json").notNull(),
  playerScore: integer("player_score").notNull(),
  bankerScore: integer("banker_score").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const barrierBattleAttempts = sqliteTable("barrier_battle_attempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  house: text("house").notNull(),
  battleDate: text("battle_date").notNull(),
  damage: integer("damage").notNull(),
  taps: integer("taps").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("barrier_battle_user_date_idx").on(table.userEmail, table.battleDate), index("barrier_battle_house_idx").on(table.house)]);

export const accessSettings = sqliteTable("access_settings", {
  key: text("key").primaryKey(),
  codeHash: text("code_hash").notNull(),
  codeHint: text("code_hint").notNull().default(""),
  enabled: integer("enabled").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const slotSpins = sqliteTable("slot_spins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  wager: integer("wager").notNull(),
  payout: integer("payout").notNull().default(0),
  result: text("result").notNull(),
  symbolsJson: text("symbols_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const slotSessions = sqliteTable("slot_sessions", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  wager: integer("wager").notNull(),
  startMs: integer("start_ms").notNull(),
  phasesJson: text("phases_json").notNull(),
  stopsJson: text("stops_json").notNull().default("[]"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const houseComments = sqliteTable("house_comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  house: text("house").notNull(),
  userEmail: text("user_email").notNull(),
  slackName: text("slack_name").notNull(),
  body: text("body").notNull(),
  commentDate: text("comment_date").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("house_comments_house_created_idx").on(table.house, table.createdAt), index("house_comments_user_date_idx").on(table.userEmail, table.commentDate)]);

export const houseCommentReactions = sqliteTable("house_comment_reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commentId: integer("comment_id").notNull(),
  userEmail: text("user_email").notNull(),
  reaction: text("reaction").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("house_comment_reaction_unique_idx").on(table.commentId, table.userEmail, table.reaction),
  index("house_comment_reaction_comment_idx").on(table.commentId),
]);

export const houseCommentReports = sqliteTable("house_comment_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commentId: integer("comment_id").notNull(),
  reporterEmail: text("reporter_email").notNull(),
  reporterSlackName: text("reporter_slack_name").notNull().default(""),
  reportedUserEmail: text("reported_user_email").notNull().default(""),
  reportedSlackName: text("reported_slack_name").notNull().default(""),
  house: text("house").notNull().default(""),
  bodySnapshot: text("body_snapshot").notNull().default(""),
  reason: text("reason").notNull().default("ルール違反の可能性"),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("house_report_comment_user_idx").on(table.commentId, table.reporterEmail)]);

export const directMessages = sqliteTable("direct_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipientEmail: text("recipient_email").notNull(),
  body: text("body").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("direct_messages_recipient_idx").on(table.recipientEmail, table.createdAt)]);

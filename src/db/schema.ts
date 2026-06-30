import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

// Users table (using Firebase Auth UID as primary key)
export const users = pgTable("users", {
  uid: text("uid").primaryKey(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Profiles
export const userProfiles = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  aiStyle: text("ai_style").notNull(),
  categoryTabs: jsonb("category_tabs").notNull(),
  extraContext: text("extra_context").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  blocker: text("blocker"),
  multitaskLevel: text("multitask_level"),
  coachingTone: text("coaching_tone"),
  peakFocusWindow: text("peak_focus_window"),
  habitFocus: text("habit_focus"),
  workspaceVibe: text("workspace_vibe"),
  googleCalendarSyncEnabled: boolean("google_calendar_sync_enabled"),
  googleTasksSyncEnabled: boolean("google_tasks_sync_enabled"),
});

// Goals
export const goals = pgTable("goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  targetDate: text("target_date").notNull(),
  progressPercentage: integer("progress_percentage").notNull(),
  confidenceScore: integer("confidence_score").notNull(),
  balanceNote: text("balance_note"),
  conflictWarning: text("conflict_warning"),
  timelineWarning: text("timeline_warning"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Goal Phases
export const goalPhases = pgTable("goal_phases", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  estimatedDuration: text("estimated_duration").notNull(),
  suggestedStartDate: text("suggested_start_date").notNull(),
  suggestedEndDate: text("suggested_end_date").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Goal Tasks
export const goalTasks = pgTable("goal_tasks", {
  id: text("id").primaryKey(),
  phaseId: text("phase_id").references(() => goalPhases.id, { onDelete: "cascade" }).notNull(),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
  suggestedDueDate: text("suggested_due_date").notNull(),
  order: integer("order").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  googleTaskId: text("google_task_id"),
  googleEventId: text("google_event_id"),
});

// Goal Resources
export const goalResources = pgTable("goal_resources", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  description: text("description").notNull(),
  createdAt: text("created_at").notNull(),
});

// Goal Chats
export const goalChats = pgTable("goal_chats", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

// Weekly Reviews
export const weeklyReviews = pgTable("weekly_reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  goalsSnapshot: text("goals_snapshot").notNull(),
  generatedAt: text("generated_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// Rebalance Histories
export const rebalanceHistories = pgTable("rebalance_histories", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  goalsSnapshot: text("goals_snapshot").notNull(),
  generatedAt: text("generated_at").notNull(),
  createdAt: text("created_at").notNull(),
});

// Goal Check Ins
export const goalCheckIns = pgTable("goal_check_ins", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").references(() => goals.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  coachingStyle: text("coaching_style").notNull(),
  diagnosticSentiment: text("diagnostic_sentiment").notNull(),
  coachingReflection: text("coaching_reflection").notNull(),
  suggestedActionToday: text("suggested_action_today").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

// Check-In Schedules
export const checkInSchedules = pgTable("check_in_schedules", {
  goalId: text("goal_id").references(() => goals.id, { onDelete: "cascade" }).primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").notNull(),
  time: text("time").notNull(),
  frequency: text("frequency").notNull(),
  lastRunAt: text("last_run_at"),
  updatedAt: text("updated_at").notNull(),
});

// Calendar Events
export const calendarEvents = pgTable("calendar_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  date: text("date").notNull(),
  associatedGoalId: text("associated_goal_id").references(() => goals.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull(),
  googleEventId: text("google_event_id"),
  googleTaskId: text("google_task_id"),
});

// Daily Todos (standalone)
export const dailyTodos = pgTable("daily_todos", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.uid, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull(),
  createdAt: text("created_at").notNull(),
  priority: text("priority"),
  notes: text("notes"),
});

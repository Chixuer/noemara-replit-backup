import { pgTable, text, boolean, bigint, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("新对话"),
  modelId: text("model_id").notNull().default("deepseek-v4-flash"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  text: text("text").notNull(),
  thinking: boolean("thinking").notNull().default(false),
  multiAnswer: jsonb("multi_answer"),
  multiAnswerActiveIdx: bigint("multi_answer_active_idx", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable);
export const selectConversationSchema = createSelectSchema(conversationsTable);
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;

export const insertMessageSchema = createInsertSchema(messagesTable);
export const selectMessageSchema = createSelectSchema(messagesTable);
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

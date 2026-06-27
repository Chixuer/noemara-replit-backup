import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/conversations", async (req, res): Promise<void> => {
  try {
    const convs = await db
      .select()
      .from(conversationsTable)
      .orderBy(conversationsTable.updatedAt);
    convs.reverse();
    res.json({ conversations: convs });
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/conversations", async (req, res): Promise<void> => {
  const { id, title, modelId, pinned, createdAt, updatedAt } = req.body as {
    id: string;
    title: string;
    modelId: string;
    pinned: boolean;
    createdAt: number;
    updatedAt: number;
  };
  if (!id || !title || !modelId) {
    res.status(400).json({ error: "id, title, and modelId are required" });
    return;
  }
  try {
    const [conv] = await db
      .insert(conversationsTable)
      .values({ id, title, modelId, pinned: pinned ?? false, createdAt, updatedAt })
      .returning();
    res.status(201).json({ ...conv, messages: [] });
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    const msgs = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(messagesTable.createdAt);
    res.json({ ...conv, messages: msgs });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.patch("/conversations/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { title, pinned, modelId, updatedAt } = req.body as {
    title?: string;
    pinned?: boolean;
    modelId?: string;
    updatedAt?: number;
  };
  try {
    const patch: Partial<typeof conversationsTable.$inferInsert> = {};
    if (title !== undefined) patch.title = title;
    if (pinned !== undefined) patch.pinned = pinned;
    if (modelId !== undefined) patch.modelId = modelId;
    patch.updatedAt = updatedAt ?? Date.now();

    const [conv] = await db
      .update(conversationsTable)
      .set(patch)
      .where(eq(conversationsTable.id, id))
      .returning();
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json(conv);
  } catch (err) {
    req.log.error({ err }, "Failed to update conversation");
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  try {
    const result = await db
      .delete(conversationsTable)
      .where(eq(conversationsTable.id, id))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const { id } = req.params;
  const { messages } = req.body as {
    messages: Array<{
      id: string;
      role: string;
      text: string;
      thinking?: boolean;
      multiAnswer?: unknown;
      multiAnswerActiveIdx?: number;
      createdAt: number;
    }>;
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }
  try {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, id));
    if (!conv) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
    await db.insert(messagesTable).values(
      messages.map((m) => ({
        id: m.id,
        conversationId: id,
        role: m.role,
        text: m.text,
        thinking: m.thinking ?? false,
        multiAnswer: m.multiAnswer ?? null,
        multiAnswerActiveIdx: m.multiAnswerActiveIdx ?? null,
        createdAt: m.createdAt,
      }))
    );
    await db
      .update(conversationsTable)
      .set({ updatedAt: Date.now() })
      .where(eq(conversationsTable.id, id));
    res.status(201).json({ count: messages.length });
  } catch (err) {
    req.log.error({ err }, "Failed to add messages");
    res.status(500).json({ error: "Failed to add messages" });
  }
});

export default router;

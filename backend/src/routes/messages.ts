import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../lib/httpError";

const router = Router();

const sendMessageSchema = z.object({
  receiverId: z.string().trim().min(1, "Receiver ID is required"),
  body: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message exceeds 2000 characters"),
});

// GET /api/messages/conversations - list recent conversation threads for logged-in user
router.get(
  "/conversations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    // Fetch all messages where current user is sender or receiver
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            profile: { select: { imageUrl: true, institution: true } },
          },
        },
        receiver: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            profile: { select: { imageUrl: true, institution: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by counterparty
    const conversationMap = new Map<
      string,
      {
        counterparty: {
          id: string;
          email: string;
          name: string;
          imageUrl?: string | null;
          institution?: string | null;
          role: string;
        };
        lastMessage: {
          id: string;
          body: string;
          createdAt: string;
          senderId: string;
          read: boolean;
        };
        unreadCount: number;
      }
    >();

    for (const msg of messages) {
      const isSender = msg.senderId === userId;
      const counterpartyUser = isSender ? msg.receiver : msg.sender;
      if (!counterpartyUser) continue;

      const otherId = counterpartyUser.id;
      const name =
        `${counterpartyUser.firstName || ""} ${counterpartyUser.lastName || ""}`.trim() ||
        counterpartyUser.email;

      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, {
          counterparty: {
            id: counterpartyUser.id,
            email: counterpartyUser.email,
            name,
            imageUrl: counterpartyUser.profile?.imageUrl || null,
            institution: counterpartyUser.profile?.institution || null,
            role: counterpartyUser.role,
          },
          lastMessage: {
            id: msg.id,
            body: msg.body,
            createdAt: msg.createdAt.toISOString(),
            senderId: msg.senderId,
            read: Boolean(msg.readAt),
          },
          unreadCount: !isSender && !msg.readAt ? 1 : 0,
        });
      } else {
        const existing = conversationMap.get(otherId)!;
        if (!isSender && !msg.readAt) {
          existing.unreadCount += 1;
        }
      }
    }

    const conversations = Array.from(conversationMap.values());
    res.json({ conversations });
  }),
);

// GET /api/messages/thread/:otherUserId - retrieve message history with another user
router.get(
  "/thread/:otherUserId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUserId = req.user!.id;
    const otherUserId = req.params.otherUserId as string;

    const otherUser = await prisma.user.findUnique({
      where: { id: otherUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        profile: { select: { imageUrl: true, institution: true } },
      },
    });

    if (!otherUser) {
      throw new HttpError(404, "Recipient user not found");
    }

    // Mark unread messages sent to current user as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: currentUserId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const formattedMessages = messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      read: Boolean(m.readAt),
    }));

    const otherName =
      `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.email;

    res.json({
      counterparty: {
        id: otherUser.id,
        email: otherUser.email,
        name: otherName,
        imageUrl: otherUser.profile?.imageUrl || null,
        institution: otherUser.profile?.institution || null,
        role: otherUser.role,
      },
      messages: formattedMessages,
    });
  }),
);

// POST /api/messages - send direct message
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { receiverId, body } = sendMessageSchema.parse(req.body);
    const senderId = req.user!.id;

    if (receiverId === senderId) {
      throw new HttpError(400, "Cannot send messages to yourself");
    }

    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true, email: true, isActive: true },
    });

    if (!receiver || !receiver.isActive) {
      throw new HttpError(404, "Recipient user not found or inactive");
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        body,
      },
    });

    // Notify receiver about the new message
    try {
      const senderName = req.user!.email;
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: "MESSAGE",
          title: `New message from ${senderName}`,
          body: body.length > 80 ? `${body.slice(0, 77)}...` : body,
        },
      });
    } catch (_) {}

    res.status(201).json({
      message: {
        id: message.id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        read: false,
      },
    });
  }),
);

// GET /api/messages/unread-count - get quick unread badge count
router.get(
  "/unread-count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await prisma.message.count({
      where: {
        receiverId: req.user!.id,
        readAt: null,
      },
    });
    res.json({ count });
  }),
);

export default router;


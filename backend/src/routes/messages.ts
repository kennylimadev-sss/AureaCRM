import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

router.get("/conversations", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const patients = await prisma.patient.findMany({
      where: { tenantId },
      include: {
        messages: { orderBy: { timestamp: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    const conversations = patients
      .map((p) => ({
        patient: {
          id: p.id,
          name: p.name,
          phone: p.phone,
          avatarUrl: p.avatarUrl,
        },
        lastMessage: p.messages[0] ?? null,
        unread: 0,
      }))
      .sort((a, b) => {
        const at = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const bt = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return bt - at;
      });
    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar conversas" });
  }
});

router.get("/patient/:patientId", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.patientId, tenantId },
    });
    if (!patient) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const messages = await prisma.message.findMany({
      where: { tenantId, patientId: patient.id },
      orderBy: { timestamp: "asc" },
    });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar mensagens" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      patientId: z.string(),
      content: z.string().min(1),
      mediaUrl: z.string().optional(),
      mediaType: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos" });
      return;
    }
    const tenantId = req.user!.userId;
    const patient = await prisma.patient.findFirst({
      where: { id: parsed.data.patientId, tenantId },
    });
    if (!patient) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const session = await prisma.whatsAppSession.findUnique({ where: { tenantId } });
    if (!session || session.status !== "CONNECTED") {
      res.status(409).json({ error: "WhatsApp desconectado. Conecte o aparelho para enviar." });
      return;
    }
    const message = await prisma.message.create({
      data: {
        tenantId,
        patientId: patient.id,
        direction: "OUTBOUND",
        content: parsed.data.content,
        mediaUrl: parsed.data.mediaUrl,
        mediaType: parsed.data.mediaType,
      },
    });
    await emitDomainEvent(tenantId, "message.sent", {
      messageId: message.id,
      patientId: patient.id,
    });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
});

router.post("/simulate-inbound", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      patientId: z.string(),
      content: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos" });
      return;
    }
    const tenantId = req.user!.userId;
    const patient = await prisma.patient.findFirst({
      where: { id: parsed.data.patientId, tenantId },
    });
    if (!patient) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const message = await prisma.message.create({
      data: {
        tenantId,
        patientId: patient.id,
        direction: "INBOUND",
        content: parsed.data.content,
      },
    });
    await emitDomainEvent(tenantId, "message.received", {
      messageId: message.id,
      patientId: patient.id,
    });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao simular mensagem" });
  }
});

export default router;

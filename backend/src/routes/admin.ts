import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { adminOnly, authRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired, adminOnly);

router.get("/esteticistas", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "ESTETICISTA" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        googleEmail: true,
        _count: { select: { patients: true, appointments: true } },
        whatsappSession: { select: { status: true, phoneNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar esteticistas" });
  }
});

router.post("/esteticistas", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      phone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (existing) {
      res.status(409).json({ error: "E-mail já cadastrado" });
      return;
    }
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        phone: parsed.data.phone,
        role: "ESTETICISTA",
      },
    });
    await prisma.kanbanStage.createMany({
      data: [
        { tenantId: user.id, name: "Novo lead", orderIndex: 0, color: "#D8BCAE" },
        { tenantId: user.id, name: "Em contato", orderIndex: 1, color: "#C98D71" },
        { tenantId: user.id, name: "Agendado", orderIndex: 2, color: "#9AAB95" },
        { tenantId: user.id, name: "Cliente", orderIndex: 3, color: "#7D8B74" },
      ],
    });
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar esteticista" });
  }
});

router.delete("/esteticistas/:id", async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, role: "ESTETICISTA" },
    });
    if (!user) {
      res.status(404).json({ error: "Esteticista não encontrado" });
      return;
    }
    await prisma.user.delete({ where: { id: user.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir esteticista" });
  }
});

router.get("/integrations", async (req: AuthRequest, res) => {
  try {
    const settings = await prisma.integrationSetting.findMany({
      where: { tenantId: req.user!.userId },
    });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar integrações" });
  }
});

router.put("/integrations", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      key: z.string().min(1),
      value: z.string(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos" });
      return;
    }
    const setting = await prisma.integrationSetting.upsert({
      where: { tenantId_key: { tenantId: req.user!.userId, key: parsed.data.key } },
      create: { tenantId: req.user!.userId, key: parsed.data.key, value: parsed.data.value },
      update: { value: parsed.data.value },
    });
    res.json(setting);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao salvar integração" });
  }
});

router.get("/webhooks", async (req: AuthRequest, res) => {
  try {
    const hooks = await prisma.webhook.findMany({
      where: { tenantId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(hooks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar webhooks" });
  }
});

router.post("/webhooks", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      url: z.string().url(),
      events: z.string().default("*"),
      secret: z.string().optional(),
      active: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const hook = await prisma.webhook.create({
      data: {
        tenantId: req.user!.userId,
        name: parsed.data.name,
        url: parsed.data.url,
        events: parsed.data.events,
        secret: parsed.data.secret,
        active: parsed.data.active ?? true,
      },
    });
    res.status(201).json(hook);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar webhook" });
  }
});

router.delete("/webhooks/:id", async (req: AuthRequest, res) => {
  try {
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, tenantId: req.user!.userId },
    });
    if (!hook) {
      res.status(404).json({ error: "Webhook não encontrado" });
      return;
    }
    await prisma.webhook.delete({ where: { id: hook.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir webhook" });
  }
});

router.get("/events", async (req: AuthRequest, res) => {
  try {
    const events = await prisma.domainEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        tenantId: true,
        type: true,
        payload: true,
        delivered: true,
        createdAt: true,
      },
    });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar eventos" });
  }
});

router.post("/webhooks/:id/test", async (req: AuthRequest, res) => {
  try {
    const hook = await prisma.webhook.findFirst({
      where: { id: req.params.id, tenantId: req.user!.userId },
    });
    if (!hook) {
      res.status(404).json({ error: "Webhook não encontrado" });
      return;
    }
    await emitDomainEvent(req.user!.userId, "webhook.test", { hookId: hook.id, name: hook.name });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao testar webhook" });
  }
});

export default router;

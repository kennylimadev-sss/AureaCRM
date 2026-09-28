import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const upsertSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  birthDate: z.string().optional().nullable(),
  cpf: z.string().optional(),
  address: z.string().optional(),
  stageId: z.string().optional().nullable(),
  source: z.string().optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const patients = await prisma.patient.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { phone: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      include: { stage: true },
      orderBy: { name: "asc" },
    });
    res.json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar pacientes" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const patient = await prisma.patient.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        stage: true,
        appointments: { orderBy: { startTime: "desc" }, take: 20, include: { procedure: true } },
        anamnesis: { orderBy: { createdAt: "desc" } },
        evolutions: {
          orderBy: { sessionDate: "desc" },
          include: { markings: { include: { procedure: true } } },
        },
        messages: { orderBy: { timestamp: "desc" }, take: 30 },
      },
    });
    if (!patient) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar paciente" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const tenantId = req.user!.userId;
    const data = parsed.data;
    let stageId = data.stageId ?? null;
    if (!stageId) {
      const first = await prisma.kanbanStage.findFirst({
        where: { tenantId },
        orderBy: { orderIndex: "asc" },
      });
      stageId = first?.id ?? null;
    }
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        notes: data.notes,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        cpf: data.cpf,
        address: data.address,
        stageId,
        source: data.source,
      },
      include: { stage: true },
    });
    await emitDomainEvent(tenantId, "patient.created", { patientId: patient.id, name: patient.name });
    res.status(201).json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar paciente" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const tenantId = req.user!.userId;
    const existing = await prisma.patient.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    const data = parsed.data;
    const patient = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        name: data.name ?? existing.name,
        phone: data.phone ?? existing.phone,
        email: data.email === undefined ? existing.email : data.email || null,
        notes: data.notes ?? existing.notes,
        birthDate: data.birthDate ? new Date(data.birthDate) : existing.birthDate,
        cpf: data.cpf ?? existing.cpf,
        address: data.address ?? existing.address,
        stageId: data.stageId === undefined ? existing.stageId : data.stageId,
        source: data.source ?? existing.source,
      },
      include: { stage: true },
    });
    await emitDomainEvent(tenantId, "patient.updated", { patientId: patient.id });
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar paciente" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const existing = await prisma.patient.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
      res.status(404).json({ error: "Paciente não encontrado" });
      return;
    }
    await prisma.patient.delete({ where: { id: existing.id } });
    await emitDomainEvent(tenantId, "patient.deleted", { patientId: existing.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir paciente" });
  }
});

export default router;

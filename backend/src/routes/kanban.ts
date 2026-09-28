import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const stageSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const stages = await prisma.kanbanStage.findMany({
      where: { tenantId },
      orderBy: { orderIndex: "asc" },
      include: {
        patients: {
          orderBy: { updatedAt: "desc" },
          include: {
            appointments: { orderBy: { startTime: "desc" }, take: 1 },
          },
        },
      },
    });
    res.json(stages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar funil" });
  }
});

router.post("/stages", async (req: AuthRequest, res) => {
  try {
    const parsed = stageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const tenantId = req.user!.userId;
    const last = await prisma.kanbanStage.findFirst({
      where: { tenantId },
      orderBy: { orderIndex: "desc" },
    });
    const stage = await prisma.kanbanStage.create({
      data: {
        tenantId,
        name: parsed.data.name,
        color: parsed.data.color ?? "#C98D71",
        orderIndex: parsed.data.orderIndex ?? (last ? last.orderIndex + 1 : 0),
      },
      include: { patients: true },
    });
    await emitDomainEvent(tenantId, "kanban.stage.created", { stageId: stage.id });
    res.status(201).json(stage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar etapa" });
  }
});

router.put("/stages/:id", async (req: AuthRequest, res) => {
  try {
    const parsed = stageSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const tenantId = req.user!.userId;
    const existing = await prisma.kanbanStage.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Etapa não encontrada" });
      return;
    }
    const stage = await prisma.kanbanStage.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name ?? existing.name,
        color: parsed.data.color ?? existing.color,
        orderIndex: parsed.data.orderIndex ?? existing.orderIndex,
      },
    });
    res.json(stage);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar etapa" });
  }
});

router.post("/stages/reorder", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ ids: z.array(z.string()).min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos" });
      return;
    }
    const tenantId = req.user!.userId;
    await prisma.$transaction(
      parsed.data.ids.map((id, index) =>
        prisma.kanbanStage.updateMany({
          where: { id, tenantId },
          data: { orderIndex: index },
        })
      )
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao reordenar etapas" });
  }
});

router.delete("/stages/:id", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const existing = await prisma.kanbanStage.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Etapa não encontrada" });
      return;
    }
    const fallback = await prisma.kanbanStage.findFirst({
      where: { tenantId, id: { not: existing.id } },
      orderBy: { orderIndex: "asc" },
    });
    await prisma.patient.updateMany({
      where: { tenantId, stageId: existing.id },
      data: { stageId: fallback?.id ?? null },
    });
    await prisma.kanbanStage.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir etapa" });
  }
});

router.post("/move", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      patientId: z.string(),
      stageId: z.string(),
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
    const stage = await prisma.kanbanStage.findFirst({
      where: { id: parsed.data.stageId, tenantId },
    });
    if (!patient || !stage) {
      res.status(404).json({ error: "Paciente ou etapa não encontrados" });
      return;
    }
    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: { stageId: stage.id },
      include: { stage: true },
    });
    await emitDomainEvent(tenantId, "kanban.lead.moved", {
      patientId: patient.id,
      stageId: stage.id,
      stageName: stage.name,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao mover lead" });
  }
});

export default router;

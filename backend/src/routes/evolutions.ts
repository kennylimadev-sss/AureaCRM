import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import { BODY_REGIONS } from "../lib/bodyMap";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const markingSchema = z.object({
  procedureId: z.string().optional().nullable(),
  bodyRegion: z.string(),
  view: z.enum(["front", "back", "face"]),
  specificNotes: z.string().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
});

const schema = z.object({
  patientId: z.string(),
  sessionDate: z.string(),
  generalNotes: z.string().optional(),
  markings: z.array(markingSchema).optional(),
});

router.get("/regions", (_req, res) => {
  res.json(BODY_REGIONS);
});

router.get("/patient/:patientId", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const evolutions = await prisma.clinicalEvolution.findMany({
      where: { tenantId, patientId: req.params.patientId },
      orderBy: { sessionDate: "desc" },
      include: { markings: { include: { procedure: true } } },
    });
    res.json(evolutions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar evoluções" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const evolution = await prisma.clinicalEvolution.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        patient: true,
        markings: { include: { procedure: true } },
      },
    });
    if (!evolution) {
      res.status(404).json({ error: "Evolução não encontrada" });
      return;
    }
    res.json(evolution);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar evolução" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
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
    const evolution = await prisma.clinicalEvolution.create({
      data: {
        tenantId,
        patientId: parsed.data.patientId,
        sessionDate: new Date(parsed.data.sessionDate),
        generalNotes: parsed.data.generalNotes,
        markings: parsed.data.markings
          ? {
              create: parsed.data.markings.map((m) => ({
                tenantId,
                procedureId: m.procedureId ?? null,
                bodyRegion: m.bodyRegion,
                view: m.view,
                specificNotes: m.specificNotes,
                posX: m.posX ?? 0,
                posY: m.posY ?? 0,
              })),
            }
          : undefined,
      },
      include: { markings: { include: { procedure: true } } },
    });
    await emitDomainEvent(tenantId, "evolution.created", {
      evolutionId: evolution.id,
      patientId: patient.id,
    });
    res.status(201).json(evolution);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar evolução" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos" });
      return;
    }
    const tenantId = req.user!.userId;
    const existing = await prisma.clinicalEvolution.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Evolução não encontrada" });
      return;
    }
    if (parsed.data.markings) {
      await prisma.bodyMapMarking.deleteMany({ where: { evolutionId: existing.id, tenantId } });
    }
    const evolution = await prisma.clinicalEvolution.update({
      where: { id: existing.id },
      data: {
        sessionDate: parsed.data.sessionDate
          ? new Date(parsed.data.sessionDate)
          : existing.sessionDate,
        generalNotes: parsed.data.generalNotes ?? existing.generalNotes,
        markings: parsed.data.markings
          ? {
              create: parsed.data.markings.map((m) => ({
                tenantId,
                procedureId: m.procedureId ?? null,
                bodyRegion: m.bodyRegion,
                view: m.view,
                specificNotes: m.specificNotes,
                posX: m.posX ?? 0,
                posY: m.posY ?? 0,
              })),
            }
          : undefined,
      },
      include: { markings: { include: { procedure: true } } },
    });
    res.json(evolution);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar evolução" });
  }
});

router.post("/:id/markings", async (req: AuthRequest, res) => {
  try {
    const parsed = markingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos" });
      return;
    }
    const tenantId = req.user!.userId;
    const existing = await prisma.clinicalEvolution.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Evolução não encontrada" });
      return;
    }
    const marking = await prisma.bodyMapMarking.create({
      data: {
        evolutionId: existing.id,
        tenantId,
        procedureId: parsed.data.procedureId ?? null,
        bodyRegion: parsed.data.bodyRegion,
        view: parsed.data.view,
        specificNotes: parsed.data.specificNotes,
        posX: parsed.data.posX ?? 0,
        posY: parsed.data.posY ?? 0,
      },
      include: { procedure: true },
    });
    res.status(201).json(marking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao adicionar marcação" });
  }
});

router.delete("/:id/markings/:markingId", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const marking = await prisma.bodyMapMarking.findFirst({
      where: { id: req.params.markingId, tenantId, evolutionId: req.params.id },
    });
    if (!marking) {
      res.status(404).json({ error: "Marcação não encontrada" });
      return;
    }
    await prisma.bodyMapMarking.delete({ where: { id: marking.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao remover marcação" });
  }
});

export default router;

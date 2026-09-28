import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const schema = z.object({
  patientId: z.string(),
  healthHistory: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  skinType: z.string().optional(),
  lifestyle: z.string().optional(),
  complaints: z.string().optional(),
  attachmentUrl: z.string().optional(),
  signedAt: z.string().optional().nullable(),
});

router.get("/patient/:patientId", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const forms = await prisma.anamnesisForm.findMany({
      where: { tenantId, patientId: req.params.patientId },
      orderBy: { createdAt: "desc" },
    });
    res.json(forms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar anamneses" });
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
    const form = await prisma.anamnesisForm.create({
      data: {
        tenantId,
        patientId: parsed.data.patientId,
        healthHistory: parsed.data.healthHistory,
        allergies: parsed.data.allergies,
        medications: parsed.data.medications,
        skinType: parsed.data.skinType,
        lifestyle: parsed.data.lifestyle,
        complaints: parsed.data.complaints,
        attachmentUrl: parsed.data.attachmentUrl,
        signedAt: parsed.data.signedAt ? new Date(parsed.data.signedAt) : null,
      },
    });
    await emitDomainEvent(tenantId, "anamnesis.created", {
      formId: form.id,
      patientId: patient.id,
    });
    res.status(201).json(form);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar anamnese" });
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
    const existing = await prisma.anamnesisForm.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Ficha não encontrada" });
      return;
    }
    const form = await prisma.anamnesisForm.update({
      where: { id: existing.id },
      data: {
        healthHistory: parsed.data.healthHistory ?? existing.healthHistory,
        allergies: parsed.data.allergies ?? existing.allergies,
        medications: parsed.data.medications ?? existing.medications,
        skinType: parsed.data.skinType ?? existing.skinType,
        lifestyle: parsed.data.lifestyle ?? existing.lifestyle,
        complaints: parsed.data.complaints ?? existing.complaints,
        attachmentUrl: parsed.data.attachmentUrl ?? existing.attachmentUrl,
        signedAt: parsed.data.signedAt ? new Date(parsed.data.signedAt) : existing.signedAt,
      },
    });
    res.json(form);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar anamnese" });
  }
});

export default router;

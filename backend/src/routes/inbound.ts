import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { apiTokenRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import type { AuthRequest } from "../types";

const router = Router();
router.use(apiTokenRequired);

const leadSchema = z
  .object({
    nome: z.string().trim().min(2).optional(),
    name: z.string().trim().min(2).optional(),
    telefone: z.string().trim().min(8).optional(),
    phone: z.string().trim().min(8).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    procedimento_interesse: z.string().trim().optional(),
    procedure_interest: z.string().trim().optional(),
    origem: z.string().trim().optional(),
    source: z.string().trim().optional(),
    status_kanban: z.string().trim().optional(),
    kanban_status: z.string().trim().optional(),
    observacoes: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  })
  .refine((d) => Boolean(d.nome || d.name), { message: "O campo nome é obrigatório", path: ["nome"] })
  .refine((d) => Boolean(d.telefone || d.phone), {
    message: "O campo telefone é obrigatório",
    path: ["telefone"],
  });

async function handleLead(req: AuthRequest, res: import("express").Response): Promise<void> {
  try {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const tenantId = req.apiTenantId!;
    const data = parsed.data;
    const name = (data.nome ?? data.name)!;
    const phone = (data.telefone ?? data.phone)!;
    const email = data.email?.trim() || null;
    const source = data.origem ?? data.source ?? null;
    const notes = data.observacoes ?? data.notes ?? null;
    const interest = data.procedimento_interesse ?? data.procedure_interest ?? null;
    const stageName = data.status_kanban ?? data.kanban_status ?? null;

    const existing = await prisma.patient.findFirst({
      where: { tenantId, OR: [{ phone }, ...(email ? [{ email }] : [])] },
    });

    let stageId: string | null | undefined;
    if (stageName) {
      const stage = await prisma.kanbanStage.findFirst({
        where: { tenantId, name: stageName },
        orderBy: { orderIndex: "asc" },
      });
      stageId = stage?.id ?? existing?.stageId ?? null;
    } else if (!existing) {
      const first = await prisma.kanbanStage.findFirst({
        where: { tenantId },
        orderBy: { orderIndex: "asc" },
      });
      stageId = first?.id ?? null;
    }

    if (existing) {
      const patient = await prisma.patient.update({
        where: { id: existing.id },
        data: {
          name,
          phone,
          email: email ?? existing.email,
          source: source ?? existing.source,
          notes: notes ?? existing.notes,
          interest: interest ?? existing.interest,
          ...(stageId !== undefined ? { stageId } : {}),
        },
        include: { stage: true },
      });
      await emitDomainEvent(tenantId, "patient.updated", { patientId: patient.id });
      res.status(200).json({
        id: patient.id,
        created: false,
        message: "Cadastro existente atualizado",
        paciente: patient,
      });
      return;
    }

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        name,
        phone,
        email,
        source,
        notes,
        interest,
        stageId: stageId ?? null,
      },
      include: { stage: true },
    });
    await emitDomainEvent(tenantId, "patient.created", { patientId: patient.id, name: patient.name });
    res.status(201).json({ id: patient.id, created: true, message: "Lead criado com sucesso", paciente: patient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao ingerir lead" });
  }
}

router.post("/leads", handleLead);
router.post("/pacientes", handleLead);

export default router;

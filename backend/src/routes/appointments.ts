import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import { emitDomainEvent } from "../lib/events";
import { syncAppointmentToGoogle } from "../lib/googleCalendar";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const appointmentInclude = {
  patient: true,
  procedure: true,
  tags: { include: { tag: true } },
} as const;

const schema = z.object({
  patientId: z.string(),
  procedureId: z.string().optional().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
    const tagId = typeof req.query.tagId === "string" ? req.query.tagId : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        ...(from || to
          ? {
              startTime: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(tagId ? { tags: { some: { tagId } } } : {}),
        ...(q
          ? {
              OR: [
                { notes: { contains: q } },
                { patient: { name: { contains: q } } },
                { tags: { some: { tag: { name: { contains: q } } } } },
              ],
            }
          : {}),
      },
      include: appointmentInclude,
      orderBy: { startTime: "asc" },
    });
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar agendamentos" });
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
    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        patientId: parsed.data.patientId,
        procedureId: parsed.data.procedureId ?? null,
        startTime: new Date(parsed.data.startTime),
        endTime: new Date(parsed.data.endTime),
        status: parsed.data.status ?? "SCHEDULED",
        notes: parsed.data.notes,
        tags:
          parsed.data.tagIds && parsed.data.tagIds.length > 0
            ? {
                create: parsed.data.tagIds.map((tagId) => ({ tenantId, tagId })),
              }
            : undefined,
      },
      include: appointmentInclude,
    });
    const googleEventId = await syncAppointmentToGoogle(tenantId, appointment);
    const withGoogle = googleEventId
      ? await prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId },
          include: appointmentInclude,
        })
      : appointment;
    await emitDomainEvent(tenantId, "appointment.created", {
      appointmentId: withGoogle.id,
      patientId: patient.id,
    });
    res.status(201).json(withGoogle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar agendamento" });
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
    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }
    if (parsed.data.tagIds) {
      await prisma.appointmentTag.deleteMany({ where: { appointmentId: existing.id, tenantId } });
    }
    const appointment = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        patientId: parsed.data.patientId ?? existing.patientId,
        procedureId:
          parsed.data.procedureId === undefined ? existing.procedureId : parsed.data.procedureId,
        startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : existing.startTime,
        endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : existing.endTime,
        status: parsed.data.status ?? existing.status,
        notes: parsed.data.notes ?? existing.notes,
        tags:
          parsed.data.tagIds && parsed.data.tagIds.length > 0
            ? {
                create: parsed.data.tagIds.map((tagId) => ({ tenantId, tagId })),
              }
            : undefined,
      },
      include: appointmentInclude,
    });
    const googleEventId = await syncAppointmentToGoogle(tenantId, appointment);
    const withGoogle = googleEventId
      ? await prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId },
          include: appointmentInclude,
        })
      : appointment;
    await emitDomainEvent(tenantId, "appointment.updated", { appointmentId: withGoogle.id });
    res.json(withGoogle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar agendamento" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }
    await prisma.appointment.delete({ where: { id: existing.id } });
    await emitDomainEvent(tenantId, "appointment.deleted", {
      appointmentId: existing.id,
      patientId: existing.patientId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir agendamento" });
  }
});

export default router;

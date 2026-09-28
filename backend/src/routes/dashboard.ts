import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [patients, todayAppointments, monthAppointments, stages, recentPatients, wa] =
      await Promise.all([
        prisma.patient.count({ where: { tenantId } }),
        prisma.appointment.findMany({
          where: { tenantId, startTime: { gte: startOfDay, lt: endOfDay } },
          include: { patient: true, procedure: true },
          orderBy: { startTime: "asc" },
        }),
        prisma.appointment.count({
          where: { tenantId, startTime: { gte: startOfMonth } },
        }),
        prisma.kanbanStage.findMany({
          where: { tenantId },
          include: { _count: { select: { patients: true } } },
          orderBy: { orderIndex: "asc" },
        }),
        prisma.patient.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.whatsAppSession.findUnique({ where: { tenantId } }),
      ]);

    res.json({
      patients,
      monthAppointments,
      todayAppointments,
      funnel: stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        count: s._count.patients,
      })),
      recentPatients,
      whatsapp: wa?.status ?? "DISCONNECTED",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar dashboard" });
  }
});

export default router;

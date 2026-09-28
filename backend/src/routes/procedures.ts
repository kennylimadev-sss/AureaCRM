import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  color: z.string().optional(),
  active: z.boolean().optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const procedures = await prisma.procedure.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    res.json(procedures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar procedimentos" });
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
    const procedure = await prisma.procedure.create({
      data: {
        tenantId,
        name: parsed.data.name,
        description: parsed.data.description,
        durationMinutes: parsed.data.durationMinutes ?? 60,
        price: parsed.data.price ?? 0,
        color: parsed.data.color ?? "#C98D71",
        active: parsed.data.active ?? true,
      },
    });
    res.status(201).json(procedure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar procedimento" });
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
    const existing = await prisma.procedure.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Procedimento não encontrado" });
      return;
    }
    const procedure = await prisma.procedure.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    res.json(procedure);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar procedimento" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const existing = await prisma.procedure.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Procedimento não encontrado" });
      return;
    }
    await prisma.procedure.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir procedimento" });
  }
});

export default router;

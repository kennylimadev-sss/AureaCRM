import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const schema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const tags = await prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { appointments: true } } },
    });
    res.json(tags);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar tags" });
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
    const existing = await prisma.tag.findFirst({
      where: { tenantId, name: parsed.data.name },
    });
    if (existing) {
      res.status(409).json({ error: "Já existe uma tag com esse nome" });
      return;
    }
    const tag = await prisma.tag.create({
      data: {
        tenantId,
        name: parsed.data.name,
        color: parsed.data.color ?? "#C98D71",
      },
    });
    res.status(201).json(tag);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao criar tag" });
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
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Tag não encontrada" });
      return;
    }
    const tag = await prisma.tag.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name ?? existing.name,
        color: parsed.data.color ?? existing.color,
      },
    });
    res.json(tag);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao atualizar tag" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Tag não encontrada" });
      return;
    }
    await prisma.tag.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao excluir tag" });
  }
});

export default router;

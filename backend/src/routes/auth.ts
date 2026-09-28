import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authRequired, signToken } from "../middleware/auth";
import type { AuthRequest, Role } from "../types";

function asRole(role: string): Role {
  return role === "ADMIN" ? "ADMIN" : "ESTETICISTA";
}

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

router.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Credenciais inválidas" });
      return;
    }
    const token = signToken({
      userId: user.id,
      tenantId: user.id,
      role: asRole(user.role),
      email: user.email,
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: asRole(user.role),
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        googleEmail: user.googleEmail,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha no login" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
      return;
    }
    const { name, email, password, phone } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ error: "E-mail já cadastrado" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        phone,
        role: "ESTETICISTA",
      },
    });
    const defaultStages = [
      { name: "Novo lead", orderIndex: 0, color: "#D8BCAE" },
      { name: "Em contato", orderIndex: 1, color: "#C98D71" },
      { name: "Agendado", orderIndex: 2, color: "#9AAB95" },
      { name: "Cliente", orderIndex: 3, color: "#7D8B74" },
    ];
    await prisma.kanbanStage.createMany({
      data: defaultStages.map((s) => ({ ...s, tenantId: user.id })),
    });
    const token = signToken({
      userId: user.id,
      tenantId: user.id,
      role: asRole(user.role),
      email: user.email,
    });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: asRole(user.role),
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        googleEmail: user.googleEmail,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha no cadastro" });
  }
});

router.get("/me", authRequired, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: asRole(user.role),
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      googleEmail: user.googleEmail,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar perfil" });
  }
});

export default router;

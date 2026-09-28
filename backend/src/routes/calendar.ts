import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";
import {
  exchangeCode,
  getAuthUrl,
  isGoogleConfigured,
  listGoogleEvents,
} from "../lib/googleCalendar";
import type { AuthRequest } from "../types";

const router = Router();

router.get("/oauth/start", authRequired, (req: AuthRequest, res) => {
  try {
    if (!isGoogleConfigured()) {
      res.status(400).json({
        error: "Google Calendar não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.",
        configured: false,
      });
      return;
    }
    const url = getAuthUrl(req.user!.userId);
    res.json({ url, configured: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao iniciar OAuth" });
  }
});

router.get("/oauth/callback", async (req, res) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const frontend = process.env.FRONTEND_URL ?? "http://localhost:3000";
    if (!code || !state) {
      res.redirect(`${frontend}/agenda?google=error`);
      return;
    }
    const { refreshToken, email } = await exchangeCode(code);
    await prisma.user.update({
      where: { id: state },
      data: {
        ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
        ...(email ? { googleEmail: email } : {}),
      },
    });
    res.redirect(`${frontend}/agenda?google=connected`);
  } catch (err) {
    console.error(err);
    const frontend = process.env.FRONTEND_URL ?? "http://localhost:3000";
    res.redirect(`${frontend}/agenda?google=error`);
  }
});

router.get("/status", authRequired, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    res.json({
      configured: isGoogleConfigured(),
      connected: Boolean(user?.googleRefreshToken),
      googleEmail: user?.googleEmail ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao consultar status" });
  }
});

router.post("/disconnect", authRequired, async (req: AuthRequest, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { googleRefreshToken: null, googleEmail: null },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao desconectar" });
  }
});

router.get("/google-events", authRequired, async (req: AuthRequest, res) => {
  try {
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date();
    const to =
      typeof req.query.to === "string"
        ? new Date(req.query.to)
        : new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = await listGoogleEvents(req.user!.userId, from, to);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao listar eventos do Google" });
  }
});

export default router;

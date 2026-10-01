import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { authRequired, API_TOKEN_KEY } from "../middleware/auth";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

const INBOUND_ENDPOINT = "/api/v1/leads";

function generateToken(): string {
  return `aurea_${crypto.randomBytes(24).toString("hex")}`;
}

router.get("/api-token", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const setting = await prisma.integrationSetting.findUnique({
      where: { tenantId_key: { tenantId, key: API_TOKEN_KEY } },
    });
    res.json({
      token: setting?.value ?? null,
      endpoint: INBOUND_ENDPOINT,
      updatedAt: setting?.updatedAt ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao carregar token de API" });
  }
});

router.post("/api-token", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    const token = generateToken();
    const setting = await prisma.integrationSetting.upsert({
      where: { tenantId_key: { tenantId, key: API_TOKEN_KEY } },
      create: { tenantId, key: API_TOKEN_KEY, value: token },
      update: { value: token },
    });
    res.status(201).json({ token: setting.value, endpoint: INBOUND_ENDPOINT, updatedAt: setting.updatedAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao gerar token de API" });
  }
});

router.delete("/api-token", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.userId;
    await prisma.integrationSetting.deleteMany({ where: { tenantId, key: API_TOKEN_KEY } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao revogar token de API" });
  }
});

export default router;

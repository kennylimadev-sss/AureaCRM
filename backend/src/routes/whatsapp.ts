import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { disconnectSession, getSession, startSession } from "../lib/whatsapp";
import type { AuthRequest } from "../types";

const router = Router();
router.use(authRequired);

router.get("/status", async (req: AuthRequest, res) => {
  try {
    const session = await getSession(req.user!.userId);
    res.json(
      session ?? {
        status: "DISCONNECTED",
        qrCode: null,
        phoneNumber: null,
        provider: "DEMO",
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao consultar WhatsApp" });
  }
});

router.post("/connect", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      provider: z.enum(["WEB", "OFFICIAL", "DEMO"]).optional(),
    });
    const parsed = schema.safeParse(req.body ?? {});
    const provider = parsed.success ? parsed.data.provider ?? "WEB" : "WEB";
    const result = await startSession(req.user!.userId, provider);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao iniciar conexão WhatsApp" });
  }
});

router.post("/disconnect", async (req: AuthRequest, res) => {
  try {
    await disconnectSession(req.user!.userId);
    res.json({ ok: true, status: "DISCONNECTED" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao desconectar WhatsApp" });
  }
});

export default router;

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authRequired } from "../middleware/auth";
import type { AuthRequest } from "../types";

const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const authReq = req as AuthRequest;
    const tenant = authReq.user?.userId ?? "anon";
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${tenant}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(jpeg|png|webp|gif)|application\/pdf|audio\/|video\//.test(file.mimetype);
    if (!ok) {
      cb(new Error("Tipo de arquivo não permitido"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();
router.use(authRequired);

router.post("/", upload.single("file"), (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Arquivo ausente" });
      return;
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({
      url,
      filename: req.file.filename,
      mime: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha no upload" });
  }
});

export default router;

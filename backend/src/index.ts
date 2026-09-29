import "dotenv/config";
import http from "http";
import path from "path";
import express from "express";
import cors from "cors";
import { Server as SocketServer } from "socket.io";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth";
import patientRoutes from "./routes/patients";
import kanbanRoutes from "./routes/kanban";
import procedureRoutes from "./routes/procedures";
import appointmentRoutes from "./routes/appointments";
import anamnesisRoutes from "./routes/anamnesis";
import evolutionRoutes from "./routes/evolutions";
import messageRoutes from "./routes/messages";
import whatsappRoutes from "./routes/whatsapp";
import calendarRoutes from "./routes/calendar";
import adminRoutes from "./routes/admin";
import uploadRoutes from "./routes/uploads";
import dashboardRoutes from "./routes/dashboard";
import tagRoutes from "./routes/tags";
import { bindSocketServer } from "./lib/events";
import { bindWhatsAppIO } from "./lib/whatsapp";
import type { JwtPayload } from "./types";

const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET ?? "estetica-jwt-secret-dev-only-change-me";
const uploadDir = process.env.UPLOAD_DIR ?? "./uploads";

const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:3000"],
    credentials: true,
  },
});

bindSocketServer(io);
bindWhatsAppIO(io);

io.use((socket, next) => {
  try {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (typeof socket.handshake.query.token === "string" ? socket.handshake.query.token : undefined);
    if (!token) {
      next(new Error("Token ausente"));
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error("Token inválido"));
  }
});

io.on("connection", (socket) => {
  const user = socket.data.user as JwtPayload;
  socket.join(`tenant:${user.userId}`);
  socket.emit("ready", { tenantId: user.userId });
});

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "15mb" }));
app.use("/uploads", express.static(path.resolve(uploadDir)));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "estetica-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/kanban", kanbanRoutes);
app.use("/api/procedures", procedureRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/anamnesis", anamnesisRoutes);
app.use("/api/evolutions", evolutionRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tags", tagRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Erro interno" });
});

server.listen(PORT, () => {
  console.log(`Estética backend listening on :${PORT}`);
});

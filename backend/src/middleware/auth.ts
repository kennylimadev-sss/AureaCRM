import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import type { AuthRequest, JwtPayload } from "../types";

const JWT_SECRET = process.env.JWT_SECRET ?? "estetica-jwt-secret-dev-only-change-me";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function authRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token ausente" });
      return;
    }
    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (decoded.role !== "ADMIN" && decoded.role !== "ESTETICISTA") {
      res.status(401).json({ error: "Token inválido" });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({ error: "Acesso restrito ao administrador" });
    return;
  }
  next();
}

export function esteticistaOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== "ESTETICISTA" && req.user.role !== "ADMIN")) {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  next();
}

export function tenantScope(user: JwtPayload): string {
  return user.role === "ADMIN" ? user.tenantId : user.userId;
}

export const API_TOKEN_KEY = "INBOUND_API_TOKEN";

export async function apiTokenRequired(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    const xApiKey = req.headers["x-api-key"];
    const token = header?.startsWith("Bearer ")
      ? header.slice(7).trim()
      : typeof xApiKey === "string"
        ? xApiKey.trim()
        : "";
    if (!token) {
      res.status(401).json({ error: "Token de API ausente" });
      return;
    }
    const setting = await prisma.integrationSetting.findFirst({
      where: { key: API_TOKEN_KEY, value: token },
    });
    if (!setting) {
      res.status(401).json({ error: "Token de API inválido" });
      return;
    }
    req.apiTenantId = setting.tenantId;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha ao validar token de API" });
  }
}

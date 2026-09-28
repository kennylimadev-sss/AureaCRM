import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
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

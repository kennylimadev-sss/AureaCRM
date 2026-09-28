import type { Request } from "express";

export type Role = "ADMIN" | "ESTETICISTA";
export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type WhatsAppProvider = "WEB" | "OFFICIAL" | "DEMO";
export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "QR_READY" | "CONNECTED" | "FAILED";

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: Role;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

export type BodyView = "front" | "back" | "face";

export interface BodyRegionDef {
  id: string;
  label: string;
  view: BodyView;
  cx: number;
  cy: number;
  r: number;
}

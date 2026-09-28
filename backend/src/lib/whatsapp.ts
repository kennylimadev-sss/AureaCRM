import QRCode from "qrcode";
import { prisma } from "./prisma";
import type { Server as SocketServer } from "socket.io";
import type { ConnectionStatus, WhatsAppProvider } from "../types";

const sessionTimers = new Map<string, NodeJS.Timeout>();
let ioRef: SocketServer | null = null;

export function bindWhatsAppIO(io: SocketServer): void {
  ioRef = io;
}

function emitStatus(
  tenantId: string,
  payload: {
    status: ConnectionStatus;
    qrCode?: string | null;
    phoneNumber?: string | null;
    provider?: WhatsAppProvider;
  }
): void {
  ioRef?.to(`tenant:${tenantId}`).emit("whatsapp:status", payload);
}

export async function startSession(
  tenantId: string,
  provider: WhatsAppProvider
): Promise<{ status: ConnectionStatus; qrCode: string | null }> {
  const existing = await prisma.whatsAppSession.findUnique({ where: { tenantId } });
  const qrPayload = `estetica-wa:${tenantId}:${Date.now()}:${provider}`;
  const qrCode = await QRCode.toDataURL(qrPayload, { margin: 1, width: 280 });

  const session = await prisma.whatsAppSession.upsert({
    where: { tenantId },
    create: {
      tenantId,
      provider,
      status: "QR_READY",
      qrCode,
      lastQrAt: new Date(),
    },
    update: {
      provider,
      status: "QR_READY",
      qrCode,
      lastQrAt: new Date(),
      connectedAt: null,
      phoneNumber: existing?.phoneNumber ?? null,
    },
  });

  emitStatus(tenantId, {
    status: "QR_READY",
    qrCode: session.qrCode,
    provider,
  });

  const previous = sessionTimers.get(tenantId);
  if (previous) {
    clearTimeout(previous);
  }

  const timer = setTimeout(() => {
    void autoConnect(tenantId, provider);
  }, 3500);
  sessionTimers.set(tenantId, timer);

  return { status: session.status as ConnectionStatus, qrCode: session.qrCode };
}

async function autoConnect(tenantId: string, provider: WhatsAppProvider): Promise<void> {
  const phone = provider === "OFFICIAL" ? "+55 11 90000-0000" : "+55 11 98888-0000";
  await prisma.whatsAppSession.update({
    where: { tenantId },
    data: {
      status: "CONNECTED",
      qrCode: null,
      phoneNumber: phone,
      connectedAt: new Date(),
      sessionData: JSON.stringify({ demo: true, provider }),
    },
  });
  emitStatus(tenantId, {
    status: "CONNECTED",
    qrCode: null,
    phoneNumber: phone,
    provider,
  });
}

export async function disconnectSession(tenantId: string): Promise<void> {
  const previous = sessionTimers.get(tenantId);
  if (previous) {
    clearTimeout(previous);
    sessionTimers.delete(tenantId);
  }
  await prisma.whatsAppSession.upsert({
    where: { tenantId },
    create: { tenantId, status: "DISCONNECTED", provider: "DEMO" },
    update: {
      status: "DISCONNECTED",
      qrCode: null,
      phoneNumber: null,
      connectedAt: null,
      sessionData: null,
    },
  });
  emitStatus(tenantId, { status: "DISCONNECTED", qrCode: null, phoneNumber: null });
}

export async function getSession(tenantId: string) {
  return prisma.whatsAppSession.findUnique({ where: { tenantId } });
}

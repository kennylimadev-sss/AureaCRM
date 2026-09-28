import { prisma } from "./prisma";
import type { Server as SocketServer } from "socket.io";

let ioRef: SocketServer | null = null;

export function bindSocketServer(io: SocketServer): void {
  ioRef = io;
}

export async function emitDomainEvent(
  tenantId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const event = await prisma.domainEvent.create({
      data: {
        tenantId,
        type,
        payload: JSON.stringify(payload),
      },
    });

    ioRef?.to(`tenant:${tenantId}`).emit("domain_event", {
      id: event.id,
      type,
      payload,
      createdAt: event.createdAt,
    });

    const webhooks = await prisma.webhook.findMany({
      where: { tenantId, active: true },
    });

    for (const hook of webhooks) {
      const events = hook.events.split(",").map((e) => e.trim());
      if (!events.includes("*") && !events.includes(type)) {
        continue;
      }
      void deliverWebhook(hook.url, hook.secret, type, payload);
    }
  } catch (err) {
    console.error("emitDomainEvent failed", err);
  }
}

async function deliverWebhook(
  url: string,
  secret: string | null,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify({ type, payload, sentAt: new Date().toISOString() }),
    });
  } catch (err) {
    console.error("webhook delivery failed", url, err);
  }
}

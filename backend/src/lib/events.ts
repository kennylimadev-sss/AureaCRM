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
    const enriched = await enrichWebhookPayload(tenantId, type, payload);

    const event = await prisma.domainEvent.create({
      data: {
        tenantId,
        type,
        payload: JSON.stringify(enriched),
      },
    });

    ioRef?.to(`tenant:${tenantId}`).emit("domain_event", {
      id: event.id,
      type,
      payload: enriched,
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
      void deliverWebhook(hook.url, hook.secret, type, enriched);
    }
  } catch (err) {
    console.error("emitDomainEvent failed", err);
  }
}

async function enrichWebhookPayload(
  tenantId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    const appointmentId = typeof payload.appointmentId === "string" ? payload.appointmentId : null;
    const patientId = typeof payload.patientId === "string" ? payload.patientId : null;

    const responsavel = await prisma.user.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    let appointment = null;
    if (appointmentId) {
      appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, tenantId },
        include: { patient: { include: { stage: true } }, procedure: true },
      });
    }

    let patient = appointment?.patient ?? null;
    if (!patient && patientId) {
      patient = await prisma.patient.findFirst({
        where: { id: patientId, tenantId },
        include: { stage: true },
      });
    }

    const procedureName = appointment?.procedure?.name ?? patient?.interest ?? null;

    return {
      evento: type,
      ...payload,
      id_cliente: patient?.id ?? null,
      nome_completo: patient?.name ?? null,
      telefone_whatsapp: patient?.phone ?? null,
      email: patient?.email ?? null,
      procedimento: procedureName,
      servico: procedureName,
      esteticista_responsavel: responsavel?.name ?? null,
      status_kanban: patient?.stage?.name ?? null,
      data_agendamento: appointment?.startTime ? appointment.startTime.toISOString() : null,
      origem_lead: patient?.source ?? null,
    };
  } catch (err) {
    console.error("webhook payload enrichment failed", err);
    return { evento: type, ...payload };
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
      body: JSON.stringify({ type, event: type, payload, data: payload, sentAt: new Date().toISOString() }),
    });
  } catch (err) {
    console.error("webhook delivery failed", url, err);
  }
}

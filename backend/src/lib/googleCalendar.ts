import { google } from "googleapis";
import { prisma } from "./prisma";

export interface AppointmentLike {
  id: string;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  googleEventId: string | null;
  patient: { name: string; phone: string };
  procedure: { name: string } | null;
}

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/calendar/oauth/callback";
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events", "email", "profile"],
    state,
  });
}

export async function exchangeCode(code: string): Promise<{
  refreshToken: string | null;
  email: string | null;
}> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? null;
  } catch {
    email = null;
  }
  return { refreshToken: tokens.refresh_token ?? null, email };
}

export async function syncAppointmentToGoogle(
  tenantId: string,
  appointment: AppointmentLike
): Promise<string | null> {
  try {
    if (!isGoogleConfigured()) {
      return appointment.googleEventId;
    }
    const user = await prisma.user.findUnique({ where: { id: tenantId } });
    if (!user?.googleRefreshToken) {
      return appointment.googleEventId;
    }
    const client = getOAuthClient();
    client.setCredentials({ refresh_token: user.googleRefreshToken });
    const calendar = google.calendar({ version: "v3", auth: client });
    const summary = appointment.procedure
      ? `${appointment.procedure.name} — ${appointment.patient.name}`
      : `Atendimento — ${appointment.patient.name}`;
    const body = {
      summary,
      description: appointment.notes ?? `Paciente: ${appointment.patient.name}\nTel: ${appointment.patient.phone}`,
      start: { dateTime: appointment.startTime.toISOString() },
      end: { dateTime: appointment.endTime.toISOString() },
    };
    if (appointment.googleEventId) {
      await calendar.events.update({
        calendarId: "primary",
        eventId: appointment.googleEventId,
        requestBody: body,
      });
      return appointment.googleEventId;
    }
    const created = await calendar.events.insert({
      calendarId: "primary",
      requestBody: body,
    });
    return created.data.id ?? null;
  } catch (err) {
    console.error("Google Calendar sync failed", err);
    return appointment.googleEventId;
  }
}

export async function listGoogleEvents(
  tenantId: string,
  timeMin: Date,
  timeMax: Date
): Promise<Array<{ id: string; summary: string; start: string; end: string }>> {
  if (!isGoogleConfigured()) {
    return [];
  }
  const user = await prisma.user.findUnique({ where: { id: tenantId } });
  if (!user?.googleRefreshToken) {
    return [];
  }
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: user.googleRefreshToken });
  const calendar = google.calendar({ version: "v3", auth: client });
  const result = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });
  return (result.data.items ?? [])
    .filter((e) => e.id && (e.start?.dateTime || e.start?.date))
    .map((e) => ({
      id: e.id as string,
      summary: e.summary ?? "Evento",
      start: (e.start?.dateTime ?? e.start?.date) as string,
      end: (e.end?.dateTime ?? e.end?.date) as string,
    }));
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Cake,
  CalendarClock,
  CreditCard,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Plus,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BodyMap } from "@/components/clinical/BodyMap";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useApi } from "@/hooks/useApi";
import { api, apiUpload, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { cn, formatDate, formatDateTime, formatTime, initials } from "@/lib/utils";
import type {
  AnamnesisForm,
  Appointment,
  BodyRegion,
  ClinicalEvolution,
  Patient,
  Procedure,
  Tag,
} from "@/lib/types";

export default function PacienteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: patient, reload } = useApi<Patient>(`/api/patients/${id}`);
  const { data: procedures } = useApi<Procedure[]>("/api/procedures");
  const { data: regions } = useApi<BodyRegion[]>("/api/evolutions/regions");
  const [anamnese, setAnamnese] = useState({
    healthHistory: "",
    allergies: "",
    medications: "",
    skinType: "",
    lifestyle: "",
    complaints: "",
  });
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedEvo, setSelectedEvo] = useState<ClinicalEvolution | null>(null);

  async function saveAnamnese(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/anamnesis", {
        method: "POST",
        body: JSON.stringify({ patientId: id, ...anamnese, signedAt: new Date().toISOString() }),
      });
      toast({ title: "Anamnese salva" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível salvar", description: message, variant: "destructive" });
    }
  }

  async function uploadAttachment(file: File, formId?: string) {
    try {
      const uploaded = await apiUpload(file);
      if (formId) {
        await api(`/api/anamnesis/${formId}`, {
          method: "PUT",
          body: JSON.stringify({ attachmentUrl: uploaded.url }),
        });
      } else {
        await api("/api/anamnesis", {
          method: "POST",
          body: JSON.stringify({ patientId: id, attachmentUrl: uploaded.url }),
        });
      }
      toast({ title: "Documento anexado" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha no upload";
      toast({ title: "Upload falhou", description: message, variant: "destructive" });
    }
  }

  async function createEvolution() {
    try {
      await api("/api/evolutions", {
        method: "POST",
        body: JSON.stringify({
          patientId: id,
          sessionDate: new Date().toISOString(),
          generalNotes: sessionNotes,
          markings: [],
        }),
      });
      setSessionNotes("");
      toast({ title: "Sessão registrada" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível registrar", description: message, variant: "destructive" });
    }
  }

  async function addMarking(
    evolutionId: string,
    payload: {
      bodyRegion: string;
      view: "front" | "back" | "face";
      procedureId: string | null;
      specificNotes: string;
      posX: number;
      posY: number;
    }
  ) {
    try {
      await api(`/api/evolutions/${evolutionId}/markings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Marcação não salva", description: message, variant: "destructive" });
    }
  }

  const appointments = useMemo(
    () =>
      [...(patient?.appointments ?? [])].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    [patient?.appointments]
  );

  const leadTags = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const appointment of patient?.appointments ?? []) {
      for (const link of appointment.tags ?? []) {
        if (!map.has(link.tag.id)) map.set(link.tag.id, link.tag);
      }
    }
    return Array.from(map.values());
  }, [patient?.appointments]);

  const { upcoming, history } = useMemo(() => {
    const now = Date.now();
    const future = appointments
      .filter((a) => new Date(a.startTime).getTime() >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const past = appointments.filter((a) => new Date(a.startTime).getTime() < now);
    return { upcoming: future, history: past.slice(0, 4) };
  }, [appointments]);

  if (!patient) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Carregando prontuário...</p>
      </AppShell>
    );
  }

  const latestEvo = patient.evolutions?.[0];
  const whatsappHref = buildWhatsAppLink(patient.phone);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-5">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-base">{initials(patient.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{patient.name}</h1>
            <StatusBadge stage={patient.stage} />
            {leadTags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {patient.phone}
            </span>
            {patient.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {patient.email}
              </span>
            ) : null}
          </div>
        </div>
        {whatsappHref ? (
          <Button asChild>
            <a href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              Abrir WhatsApp
            </a>
          </Button>
        ) : (
          <Button disabled variant="outline">
            <MessageCircle className="mr-2 h-4 w-4" />
            Sem telefone
          </Button>
        )}
      </div>
      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
          <TabsTrigger value="mapa">Mapa corporal</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Dados cadastrais</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border p-0">
                  <InfoField icon={Phone} label="Telefone" value={patient.phone} />
                  <InfoField icon={Mail} label="E-mail" value={patient.email} />
                  <InfoField icon={CreditCard} label="CPF" value={patient.cpf} />
                  <InfoField
                    icon={Cake}
                    label="Data de nascimento"
                    value={patient.birthDate ? formatDate(patient.birthDate) : null}
                  />
                  <InfoField icon={MapPin} label="Endereço" value={patient.address} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Comercial &amp; Marketing</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border p-0">
                  <InfoField icon={Megaphone} label="Origem do lead" value={patient.source} />
                  <InfoField
                    icon={StickyNote}
                    label="Procedimento de interesse"
                    value={patient.interest}
                  />
                  <InfoField
                    icon={UserRound}
                    label="Esteticista responsável"
                    value={patient.tenant?.name}
                  />
                  <InfoField
                    icon={CalendarClock}
                    label="Data de registo"
                    value={formatDate(patient.createdAt)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Observações rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-foreground">
                    {patient.notes?.trim() ? patient.notes : (
                      <span className="text-muted-foreground">Sem observações registadas.</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="lg:sticky lg:top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Próximos horários &amp; histórico</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {upcoming.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                      <CalendarClock className="h-7 w-7 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Nenhum agendamento futuro</p>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/agenda?patientId=${patient.id}`}>
                          <Plus className="mr-2 h-4 w-4" />
                          Agendar avaliação
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcoming.map((a) => (
                        <AppointmentRow key={a.id} appointment={a} professional={patient.tenant?.name} />
                      ))}
                    </div>
                  )}

                  {history.length > 0 ? (
                    <div className="border-t pt-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Histórico recente
                      </p>
                      <div className="space-y-2">
                        {history.map((a) => (
                          <AppointmentRow
                            key={a.id}
                            appointment={a}
                            professional={patient.tenant?.name}
                            muted
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="anamnese">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ficha digital</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveAnamnese} className="space-y-3">
                  <Field label="Histórico de saúde" value={anamnese.healthHistory} onChange={(v) => setAnamnese({ ...anamnese, healthHistory: v })} />
                  <Field label="Alergias" value={anamnese.allergies} onChange={(v) => setAnamnese({ ...anamnese, allergies: v })} />
                  <Field label="Medicamentos" value={anamnese.medications} onChange={(v) => setAnamnese({ ...anamnese, medications: v })} />
                  <div className="space-y-1">
                    <Label>Tipo de pele</Label>
                    <Input value={anamnese.skinType} onChange={(e) => setAnamnese({ ...anamnese, skinType: e.target.value })} />
                  </div>
                  <Field label="Hábitos" value={anamnese.lifestyle} onChange={(v) => setAnamnese({ ...anamnese, lifestyle: v })} />
                  <Field label="Queixas" value={anamnese.complaints} onChange={(v) => setAnamnese({ ...anamnese, complaints: v })} />
                  <Button type="submit">Salvar ficha</Button>
                </form>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload da ficha física</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAttachment(file);
                    }}
                  />
                </CardContent>
              </Card>
              {(patient.anamnesis ?? []).map((f: AnamnesisForm) => (
                <Card key={f.id}>
                  <CardHeader>
                    <CardTitle className="text-sm">{formatDate(f.createdAt)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Alergias: {f.allergies ?? "—"}</p>
                    <p>Queixas: {f.complaints ?? "—"}</p>
                    {f.attachmentUrl ? (
                      <a className="text-primary underline" href={f.attachmentUrl} target="_blank" rel="noreferrer">
                        Ver anexo
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="mapa">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Marcar sessão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Notas gerais da sessão"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                />
                <Button onClick={() => void createEvolution()}>Abrir sessão de hoje</Button>
                <p className="text-xs text-muted-foreground">
                  Depois de abrir a sessão, clique nas regiões para registrar procedimentos.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <BodyMap
                  regions={regions ?? []}
                  markings={latestEvo?.markings ?? []}
                  procedures={procedures ?? []}
                  interactive={Boolean(latestEvo)}
                  onAdd={latestEvo ? (payload) => addMarking(latestEvo.id, payload) : undefined}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="evolucao">
          <div className="space-y-3">
            {(patient.evolutions ?? []).map((evo) => (
              <button
                key={evo.id}
                className="w-full rounded-2xl border bg-card p-4 text-left shadow-sm hover:shadow-card"
                onClick={() => setSelectedEvo(evo)}
              >
                <p className="font-medium">{formatDate(evo.sessionDate)}</p>
                <p className="text-sm text-muted-foreground">{evo.generalNotes ?? "Sem notas gerais"}</p>
                <p className="mt-1 text-xs text-primary">{evo.markings.length} marcações no mapa</p>
              </button>
            ))}
          </div>
          <Dialog open={Boolean(selectedEvo)} onOpenChange={(o) => !o && setSelectedEvo(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Sessão {selectedEvo ? formatDate(selectedEvo.sessionDate) : ""}
                </DialogTitle>
              </DialogHeader>
              {selectedEvo ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <p className="text-sm md:col-span-2">{selectedEvo.generalNotes}</p>
                  <BodyMap
                    regions={regions ?? []}
                    markings={selectedEvo.markings}
                    procedures={procedures ?? []}
                  />
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function buildWhatsAppLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

function shortWeekday(iso: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(iso));
  return label.replace(".", "").slice(0, 3).toUpperCase();
}

function StatusBadge({ stage }: { stage?: { name: string; color: string } | null }) {
  const color = stage?.color ?? "#9AAB95";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1A`, borderColor: `${color}66`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {stage?.name ?? "Sem etapa"}
    </span>
  );
}

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${tag.color}1A`, borderColor: `${tag.color}66`, color: tag.color }}
    >
      {tag.name}
    </span>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
}) {
  const hasValue = Boolean(value && value.trim());
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium text-foreground">{hasValue ? value : "—"}</p>
      </div>
    </div>
  );
}

function AppointmentRow({
  appointment,
  professional,
  muted = false,
}: {
  appointment: Appointment;
  professional?: string | null;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-center",
          muted && "opacity-70"
        )}
      >
        <span className="text-[10px] uppercase text-muted-foreground">
          {shortWeekday(appointment.startTime)}
        </span>
        <span className="text-sm font-semibold leading-none">
          {new Date(appointment.startTime).getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{appointment.procedure?.name ?? "Atendimento"}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(appointment.startTime)} · {formatTime(appointment.endTime)}
        </p>
        {professional ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Profissional: {professional}</p>
        ) : null}
      </div>
    </div>
  );
}

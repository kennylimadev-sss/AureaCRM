"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { formatTime } from "@/lib/utils";
import type { Appointment, Patient, Procedure } from "@/lib/types";

type ViewMode = "day" | "week" | "month";

export default function AgendaPage() {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<ViewMode>("week");
  const from = useMemo(() => startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), [cursor]);
  const to = useMemo(() => addDays(endOfMonth(cursor), 7), [cursor]);
  const { data, reload } = useApi<Appointment[]>(
    `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`,
    [from.toISOString(), to.toISOString()]
  );
  const { data: patients } = useApi<Patient[]>("/api/patients");
  const { data: procedures } = useApi<Procedure[]>("/api/procedures");
  const { data: gStatus, reload: reloadG } = useApi<{
    configured: boolean;
    connected: boolean;
    googleEmail: string | null;
  }>("/api/calendar/status");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    procedureId: "",
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endTime: format(addDays(new Date(), 0), "yyyy-MM-dd'T'HH:mm"),
    notes: "",
  });

  async function createApt(e: FormEvent) {
    e.preventDefault();
    try {
      const start = new Date(form.startTime);
      const proc = (procedures ?? []).find((p) => p.id === form.procedureId);
      const end = form.endTime
        ? new Date(form.endTime)
        : new Date(start.getTime() + (proc?.durationMinutes ?? 60) * 60000);
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId: form.patientId,
          procedureId: form.procedureId || null,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: form.notes,
        }),
      });
      setOpen(false);
      await reload();
      toast({ title: "Horário agendado" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível agendar", description: message, variant: "destructive" });
    }
  }

  async function connectGoogle() {
    try {
      const res = await api<{ url: string }>("/api/calendar/oauth/start");
      window.location.href = res.url;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Google não configurado";
      toast({ title: "OAuth indisponível", description: message, variant: "destructive" });
    }
  }

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor, view]);

  const byDay = (day: Date) =>
    (data ?? []).filter((a) => format(new Date(a.startTime), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={() => setCursor(addDays(cursor, view === "month" ? -30 : view === "week" ? -7 : -1))}>
            Anterior
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" onClick={() => setCursor(addDays(cursor, view === "month" ? 30 : view === "week" ? 7 : 1))}>
            Próximo
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Novo horário</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agendar</DialogTitle>
              </DialogHeader>
              <form onSubmit={createApt} className="space-y-3">
                <div className="space-y-1">
                  <Label>Paciente</Label>
                  <select
                    className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm"
                    value={form.patientId}
                    onChange={(e) => setForm({ ...form, patientId: e.target.value })}
                    required
                  >
                    <option value="">Selecionar</option>
                    {(patients ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Procedimento</Label>
                  <select
                    className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm"
                    value={form.procedureId}
                    onChange={(e) => setForm({ ...form, procedureId: e.target.value })}
                  >
                    <option value="">Avulso</option>
                    {(procedures ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.durationMinutes} min)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Início</Label>
                  <Input
                    type="datetime-local"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Salvar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Google Agenda</p>
            <p className="text-xs text-muted-foreground">
              {gStatus?.connected
                ? `Sincronizado com ${gStatus.googleEmail}`
                : gStatus?.configured
                  ? "OAuth disponível — conecte sua conta"
                  : "Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no backend para ativar o 2-way sync"}
            </p>
          </div>
          {gStatus?.connected ? (
            <Button
              variant="outline"
              onClick={async () => {
                await api("/api/calendar/disconnect", { method: "POST" });
                await reloadG();
              }}
            >
              Desconectar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void connectGoogle()}>
              Conectar Google
            </Button>
          )}
        </CardContent>
      </Card>
      <div className={view === "month" ? "grid grid-cols-7 gap-2" : "grid gap-3 md:grid-cols-2 xl:grid-cols-4"}>
        {days.map((day) => (
          <Card key={day.toISOString()} className="min-h-[120px]">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {format(day, view === "month" ? "d" : "EEE d MMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-3 pt-0">
              {byDay(day).map((a) => (
                <div key={a.id} className="rounded-lg bg-primary/10 px-2 py-1 text-xs">
                  <p className="font-medium">
                    {formatTime(a.startTime)} · {a.patient?.name}
                  </p>
                  <p className="text-muted-foreground">{a.procedure?.name}</p>
                  <Badge variant="outline" className="mt-1">
                    {a.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import { addDays, endOfMonth, format, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Tag as TagIcon, Plus, Pencil, Trash2 } from "lucide-react";
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
import { cn, formatDateTime, formatTime } from "@/lib/utils";
import type { Appointment, AppointmentStatus, Patient, Procedure, Tag } from "@/lib/types";

type ViewMode = "day" | "week" | "month";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Faltou",
};

const STATUS_OPTIONS: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const TAG_PALETTE = ["#C98D71", "#9AAB95", "#D8BCAE", "#7D8B74", "#B08968", "#A98467", "#8A6A55", "#6B8F71"];

export default function AgendaPage() {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<ViewMode>("week");
  const [tagQuery, setTagQuery] = useState("");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const from = useMemo(() => startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), [cursor]);
  const to = useMemo(() => addDays(endOfMonth(cursor), 7), [cursor]);
  const { data, reload } = useApi<Appointment[]>(
    `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`,
    [from.toISOString(), to.toISOString()]
  );
  const { data: patients } = useApi<Patient[]>("/api/patients");
  const { data: procedures } = useApi<Procedure[]>("/api/procedures");
  const { data: tags, reload: reloadTags } = useApi<Tag[]>("/api/tags");
  const { data: gStatus, reload: reloadG } = useApi<{
    configured: boolean;
    connected: boolean;
    googleEmail: string | null;
  }>("/api/calendar/status");
  const [open, setOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    procedureId: "",
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: "",
    tagIds: [] as string[],
  });
  const [tagForm, setTagForm] = useState({ name: "", color: "#C98D71" });
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const filteredTags = useMemo(() => {
    const term = tagQuery.trim().toLowerCase();
    return (tags ?? []).filter((t) => t.name.toLowerCase().includes(term));
  }, [tags, tagQuery]);

  const visibleAppointments = useMemo(() => {
    const term = tagQuery.trim().toLowerCase();
    return (data ?? []).filter((a) => {
      const aptTags = a.tags?.map((l) => l.tag) ?? [];
      if (activeTagId && !aptTags.some((t) => t.id === activeTagId)) return false;
      if (!term) return true;
      return aptTags.some((t) => t.name.toLowerCase().includes(term));
    });
  }, [data, activeTagId, tagQuery]);

  async function createApt(e: FormEvent) {
    e.preventDefault();
    try {
      const start = new Date(form.startTime);
      const proc = (procedures ?? []).find((p) => p.id === form.procedureId);
      const end = new Date(start.getTime() + (proc?.durationMinutes ?? 60) * 60000);
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId: form.patientId,
          procedureId: form.procedureId || null,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: form.notes,
          tagIds: form.tagIds,
        }),
      });
      setOpen(false);
      setForm({
        patientId: "",
        procedureId: "",
        startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        notes: "",
        tagIds: [],
      });
      await reload();
      toast({ title: "Horário agendado" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível agendar", description: message, variant: "destructive" });
    }
  }

  async function updateAppointment(id: string, payload: Record<string, unknown>) {
    try {
      const updated = await api<Appointment>(`/api/appointments/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSelected(updated);
      await reload();
      toast({ title: "Agendamento atualizado" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível atualizar", description: message, variant: "destructive" });
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

  async function saveTag(e: FormEvent) {
    e.preventDefault();
    try {
      if (editingTag) {
        await api(`/api/tags/${editingTag.id}`, {
          method: "PUT",
          body: JSON.stringify(tagForm),
        });
      } else {
        await api("/api/tags", { method: "POST", body: JSON.stringify(tagForm) });
      }
      setTagForm({ name: "", color: "#C98D71" });
      setEditingTag(null);
      await reloadTags();
      toast({ title: editingTag ? "Tag atualizada" : "Tag criada" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível salvar a tag", description: message, variant: "destructive" });
    }
  }

  async function deleteTag(id: string) {
    try {
      await api(`/api/tags/${id}`, { method: "DELETE" });
      if (activeTagId === id) setActiveTagId(null);
      await reloadTags();
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível excluir", description: message, variant: "destructive" });
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
    visibleAppointments.filter(
      (a) => format(new Date(a.startTime), "yyyy-MM-dd") === format(day, "yyyy-MM-dd")
    );

  const dayEvents = dayOpen ? byDay(dayOpen) : [];

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
                <TagPicker
                  tags={tags ?? []}
                  selectedIds={form.tagIds}
                  onChange={(tagIds) => setForm({ ...form, tagIds })}
                />
                <Button type="submit" className="w-full">
                  Salvar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Pesquisar tags (ex: confirmada, retorno)"
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => setTagsOpen(true)}>
              <TagIcon className="mr-2 h-4 w-4" />
              Gerenciar tags
            </Button>
            {activeTagId ? (
              <Button variant="ghost" size="sm" onClick={() => setActiveTagId(null)}>
                Limpar filtro
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma tag encontrada.</p>
            ) : (
              filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
                    activeTagId === tag.id ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-90 hover:opacity-100"
                  )}
                  style={{
                    backgroundColor: `${tag.color}22`,
                    borderColor: tag.color,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

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
        {days.map((day) => {
          const items = byDay(day);
          const outside = view === "month" && !isSameMonth(day, cursor);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setDayOpen(day)}
              className={cn(
                "min-h-[120px] rounded-2xl border bg-card p-3 text-left shadow-sm transition hover:shadow-card hover:border-primary/40",
                outside && "opacity-50"
              )}
            >
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {format(day, view === "month" ? "d" : "EEE d MMM", { locale: ptBR })}
              </p>
              <div className="space-y-1">
                {items.slice(0, view === "month" ? 3 : 4).map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg bg-primary/10 px-2 py-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(a);
                    }}
                  >
                    <p className="font-medium">
                      {formatTime(a.startTime)} · {a.patient?.name}
                    </p>
                    <p className="truncate text-muted-foreground">{a.procedure?.name}</p>
                    <TagChips tags={a.tags?.map((l) => l.tag) ?? []} />
                  </div>
                ))}
                {items.length > (view === "month" ? 3 : 4) ? (
                  <p className="text-[11px] text-primary">+{items.length - (view === "month" ? 3 : 4)} no dia</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={Boolean(dayOpen)} onOpenChange={(o) => !o && setDayOpen(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dayOpen ? format(dayOpen, "EEEE, d 'de' MMMM", { locale: ptBR }) : "Dia"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-auto">
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum atendimento neste dia.</p>
            ) : (
              dayEvents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="w-full rounded-xl border bg-muted/40 p-3 text-left transition hover:border-primary/50 hover:bg-muted"
                  onClick={() => setSelected(a)}
                >
                  <p className="font-medium">
                    {formatTime(a.startTime)} — {formatTime(a.endTime)} · {a.patient?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">{a.procedure?.name ?? "Atendimento"}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{STATUS_LABEL[a.status]}</Badge>
                    <TagChips tags={a.tags?.map((l) => l.tag) ?? []} />
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.patient?.name ?? "Agendamento"}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Horário: </span>
                {formatDateTime(selected.startTime)} — {formatTime(selected.endTime)}
              </p>
              <p>
                <span className="text-muted-foreground">Procedimento: </span>
                {selected.procedure?.name ?? "Avulso"}
              </p>
              <p>
                <span className="text-muted-foreground">Telefone: </span>
                {selected.patient?.phone ?? "—"}
              </p>
              {selected.notes ? <p>{selected.notes}</p> : null}
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm"
                  value={selected.status}
                  onChange={(e) => void updateAppointment(selected.id, { status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <TagPicker
                tags={tags ?? []}
                selectedIds={selected.tags?.map((l) => l.tagId) ?? []}
                onChange={(tagIds) => void updateAppointment(selected.id, { tagIds })}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={tagsOpen}
        onOpenChange={(o) => {
          setTagsOpen(o);
          if (!o) {
            setEditingTag(null);
            setTagForm({ name: "", color: "#C98D71" });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar tags</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveTag} className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input
                value={tagForm.name}
                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                placeholder="Ex: Confirmada"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full border",
                      tagForm.color === color && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setTagForm({ ...tagForm, color })}
                    aria-label={color}
                  />
                ))}
                <Input
                  type="color"
                  className="h-10 w-14 p-1"
                  value={tagForm.color}
                  onChange={(e) => setTagForm({ ...tagForm, color: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              {editingTag ? "Salvar tag" : "Criar tag"}
            </Button>
          </form>
          <div className="max-h-56 space-y-2 overflow-auto">
            {(tags ?? []).map((tag) => (
              <div key={tag.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}` }}
                >
                  {tag.name}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingTag(tag);
                      setTagForm({ name: tag.name, color: tag.color });
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void deleteTag(tag.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function TagChips({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${tag.color}33`, color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  );
}

function TagPicker({
  tags,
  selectedIds,
  onChange,
}: {
  tags: Tag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>Tags</Label>
      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Crie tags em Gerenciar tags.</p>
        ) : (
          tags.map((tag) => {
            const on = selectedIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  on ? "ring-2 ring-offset-1" : "opacity-80"
                )}
                style={{
                  backgroundColor: on ? `${tag.color}33` : "transparent",
                  borderColor: tag.color,
                  color: tag.color,
                }}
                onClick={() =>
                  onChange(on ? selectedIds.filter((id) => id !== tag.id) : [...selectedIds, tag.id])
                }
              >
                {tag.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

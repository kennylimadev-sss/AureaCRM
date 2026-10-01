"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const VIEW_LABEL: Record<ViewMode, string> = { day: "Dia", week: "Semana", month: "Mês" };

function rangeForView(cursor: Date, view: ViewMode): { from: Date; to: Date } {
  if (view === "day") {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 0, 0, 0, 0);
    const to = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59, 999);
    return { from, to };
  }
  if (view === "week") {
    const from = startOfWeek(cursor, { weekStartsOn: 1 });
    const to = endOfWeek(cursor, { weekStartsOn: 1 });
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  const from = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export default function AgendaPage() {
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [tagQuery, setTagQuery] = useState("");
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const { from, to } = useMemo(() => rangeForView(cursor, view), [cursor, view]);
  const { data, reload, loading } = useApi<Appointment[]>(
    `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`,
    [from.toISOString(), to.toISOString()]
  );
  const { data: patients } = useApi<Patient[]>("/api/patients");
  const { data: procedures } = useApi<Procedure[]>("/api/procedures");
  const { data: tags, reload: reloadTags } = useApi<Tag[]>("/api/tags");
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
      const patientName = a.patient?.name.toLowerCase() ?? "";
      return aptTags.some((t) => t.name.toLowerCase().includes(term)) || patientName.includes(term);
    });
  }, [data, activeTagId, tagQuery]);

  function openCreate(day?: Date) {
    const base = day ?? new Date();
    const start = new Date(base);
    if (day) start.setHours(9, 0, 0, 0);
    setForm({
      patientId: "",
      procedureId: "",
      startTime: format(start, "yyyy-MM-dd'T'HH:mm"),
      notes: "",
      tagIds: [],
    });
    setOpen(true);
  }

  async function createApt(e: FormEvent) {
    e.preventDefault();
    try {
      const start = new Date(form.startTime);
      if (Number.isNaN(start.getTime())) {
        toast({ title: "Data inválida", variant: "destructive" });
        return;
      }
      const proc = (procedures ?? []).find((p) => p.id === form.procedureId);
      const end = new Date(start.getTime() + (proc?.durationMinutes ?? 60) * 60000);
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId: form.patientId,
          procedureId: form.procedureId || null,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: form.notes || undefined,
          tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
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

  async function saveTag(e: FormEvent) {
    e.preventDefault();
    try {
      if (editingTag) {
        await api(`/api/tags/${editingTag.id}`, { method: "PUT", body: JSON.stringify(tagForm) });
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

  function shift(dir: -1 | 1) {
    if (view === "day") setCursor(addDays(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else setCursor(addMonths(cursor, dir));
  }

  const cells = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor, view]);

  const byDay = (day: Date) =>
    visibleAppointments.filter((a) => isSameDay(new Date(a.startTime), day));

  const title =
    view === "day"
      ? format(cursor, "d 'de' MMMM yyyy", { locale: ptBR })
      : view === "week"
        ? `${format(startOfWeek(cursor, { weekStartsOn: 1 }), "d MMM", { locale: ptBR })} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), "d MMM yyyy", { locale: ptBR })}`
        : format(cursor, "MMMM yyyy", { locale: ptBR });

  const dayEvents = dayOpen ? byDay(dayOpen) : [];
  const maxChips = view === "month" ? 3 : 8;

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
          Hoje
        </Button>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-xl font-normal capitalize hover:bg-muted">
              {title}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(cursor.getFullYear(), i, 1);
              return (
                <DropdownMenuItem key={i} onClick={() => setCursor(d)}>
                  {format(d, "MMMM yyyy", { locale: ptBR })}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-52 pl-9 md:w-64"
              placeholder="Pesquisar tags ou paciente"
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setTagsOpen(true)}>
            <TagIcon className="mr-2 h-4 w-4" />
            Tags
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {VIEW_LABEL[view]}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setView("day")}>Dia</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView("week")}>Semana</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView("month")}>Mês</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setView("week")}>7 dias</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="mr-1 h-4 w-4" />
            Agendar
          </Button>
        </div>
      </div>

      {filteredTags.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {filteredTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                activeTagId === tag.id && "ring-2 ring-offset-1 ring-offset-background"
              )}
              style={{ backgroundColor: `${tag.color}22`, borderColor: tag.color, color: tag.color }}
            >
              {tag.name}
            </button>
          ))}
          {activeTagId ? (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setActiveTagId(null)}>
              Limpar filtro
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? <p className="mb-2 text-xs text-muted-foreground">Carregando agenda...</p> : null}

      <div className="overflow-hidden rounded-xl border bg-card">
        {view !== "day" ? (
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-medium tracking-wide text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
        ) : null}
        <div className={view === "month" ? "grid grid-cols-7" : view === "week" ? "grid grid-cols-7" : "grid grid-cols-1"}>
          {cells.map((day, idx) => {
            const items = byDay(day);
            const outside = view === "month" && !isSameMonth(day, cursor);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[110px] cursor-pointer border-b p-1.5 text-left transition hover:bg-muted/40",
                  view !== "day" && idx % 7 !== 6 && "border-r",
                  view === "week" && "min-h-[280px]",
                  view === "day" && "min-h-[420px] p-3"
                )}
                onClick={() => setDayOpen(day)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm",
                      outside && "text-muted-foreground/50",
                      today && "bg-primary text-primary-foreground font-medium"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:opacity-100 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreate(day);
                    }}
                    aria-label="Novo horário"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, maxChips).map((a) => {
                    const color = a.tags?.[0]?.tag.color ?? "#9AAB95";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                        style={{ backgroundColor: color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(a);
                        }}
                      >
                        {formatTime(a.startTime)} {a.patient?.name}
                      </button>
                    );
                  })}
                  {items.length > maxChips ? (
                    <p className="px-1 text-[11px] text-muted-foreground">+{items.length - maxChips} mais</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(dayOpen)} onOpenChange={(o) => !o && setDayOpen(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dayOpen ? format(dayOpen, "EEEE, d 'de' MMMM", { locale: ptBR }) : "Dia"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => dayOpen && openCreate(dayOpen)}>
              Novo horário neste dia
            </Button>
          </div>
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

      <Dialog open={open} onOpenChange={setOpen}>
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

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import type { KanbanStage, Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function FunilPage() {
  const { data, reload } = useApi<KanbanStage[]>("/api/kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [stageName, setStageName] = useState("");
  const [open, setOpen] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [lead, setLead] = useState({ name: "", phone: "", email: "", stageId: "" });

  async function move(patientId: string, stageId: string) {
    try {
      await api("/api/kanban/move", {
        method: "POST",
        body: JSON.stringify({ patientId, stageId }),
      });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha ao mover";
      toast({ title: "Não foi possível mover o lead", description: message, variant: "destructive" });
    }
  }

  async function createStage(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/kanban/stages", { method: "POST", body: JSON.stringify({ name: stageName }) });
      setStageName("");
      setOpen(false);
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível criar etapa", description: message, variant: "destructive" });
    }
  }

  async function createLead(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/patients", {
        method: "POST",
        body: JSON.stringify(lead),
      });
      setLead({ name: "", phone: "", email: "", stageId: "" });
      setLeadOpen(false);
      await reload();
      toast({ title: "Lead criado" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível criar lead", description: message, variant: "destructive" });
    }
  }

  async function renameStage(id: string, name: string) {
    try {
      await api(`/api/kanban/stages/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível renomear", description: message, variant: "destructive" });
    }
  }

  async function deleteStage(id: string) {
    try {
      await api(`/api/kanban/stages/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível excluir", description: message, variant: "destructive" });
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Funil de vendas</h1>
          <p className="text-sm text-muted-foreground">Arraste os cards entre as etapas.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
            <DialogTrigger asChild>
              <Button>Novo lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo lead</DialogTitle>
              </DialogHeader>
              <form onSubmit={createLead} className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label>WhatsApp</Label>
                  <Input value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Etapa</Label>
                  <select
                    className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm"
                    value={lead.stageId}
                    onChange={(e) => setLead({ ...lead, stageId: e.target.value })}
                  >
                    <option value="">Primeira etapa</option>
                    {(data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full">
                  Salvar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Nova etapa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova coluna</DialogTitle>
              </DialogHeader>
              <form onSubmit={createStage} className="space-y-3">
                <Input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Nome da etapa" />
                <Button type="submit" className="w-full">
                  Criar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-6">
        {(data ?? []).map((stage) => (
          <div
            key={stage.id}
            className="kanban-col flex flex-col rounded-2xl bg-muted/50 p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingId) void move(draggingId, stage.id);
              setDraggingId(null);
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                <input
                  defaultValue={stage.name}
                  className="w-36 bg-transparent text-sm font-semibold outline-none"
                  onBlur={(e) => {
                    if (e.target.value !== stage.name) void renameStage(stage.id, e.target.value);
                  }}
                />
                <span className="text-xs text-muted-foreground">{stage.patients.length}</span>
              </div>
              <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => void deleteStage(stage.id)}>
                excluir
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {stage.patients.map((p) => (
                <LeadCard key={p.id} patient={p} onDragStart={() => setDraggingId(p.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function LeadCard({ patient, onDragStart }: { patient: Patient; onDragStart: () => void }) {
  return (
    <Link
      href={`/pacientes/${patient.id}`}
      draggable
      onDragStart={onDragStart}
      className={cn(
        "block cursor-grab rounded-xl border bg-card p-3 shadow-sm transition hover:shadow-card"
      )}
    >
      <p className="text-sm font-medium">{patient.name}</p>
      <p className="text-xs text-muted-foreground">{patient.phone}</p>
      {patient.source ? <p className="mt-1 text-[11px] text-primary">{patient.source}</p> : null}
    </Link>
  );
}

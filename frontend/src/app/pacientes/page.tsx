"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import type { Patient } from "@/lib/types";
import { initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function PacientesPage() {
  const { data, reload } = useApi<Patient[]>("/api/patients");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return (data ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.phone.includes(term) ||
        (p.email ?? "").toLowerCase().includes(term)
    );
  }, [data, q]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/patients", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ name: "", phone: "", email: "", notes: "" });
      await reload();
      toast({ title: "Paciente cadastrado" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível cadastrar", description: message, variant: "destructive" });
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Cadastro, prontuário e histórico clínico.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Novo paciente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastro</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Input
        className="mb-4 max-w-sm"
        placeholder="Buscar por nome, telefone ou e-mail"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => (
          <Link key={p.id} href={`/pacientes/${p.id}`}>
            <Card className="transition hover:shadow-card">
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar>
                  <AvatarFallback>{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.phone}</p>
                  {p.stage ? <p className="text-xs text-primary">{p.stage.name}</p> : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

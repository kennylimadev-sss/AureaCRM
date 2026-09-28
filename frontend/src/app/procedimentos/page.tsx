"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { Procedure } from "@/lib/types";

export default function ProcedimentosPage() {
  const { data, reload } = useApi<Procedure[]>("/api/procedures");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: 60,
    price: 0,
    color: "#C98D71",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/procedures", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ name: "", description: "", durationMinutes: 60, price: 0, color: "#C98D71" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível salvar", description: message, variant: "destructive" });
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Catálogo de procedimentos</h1>
          <p className="text-sm text-muted-foreground">Usado na agenda e no mapa corporal.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Novo procedimento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Procedimento</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Duração (min)</Label>
                  <Input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Preço</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                {p.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{p.description}</p>
              <p className="mt-2 text-foreground">
                {p.durationMinutes} min · {formatCurrency(p.price)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

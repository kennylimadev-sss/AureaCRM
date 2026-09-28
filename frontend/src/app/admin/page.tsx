"use client";

import { FormEvent, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

interface EsteticistaRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  _count: { patients: number; appointments: number };
  whatsappSession: { status: string; phoneNumber: string | null } | null;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string;
  active: boolean;
}

interface EventRow {
  id: string;
  type: string;
  payload: string;
  createdAt: string;
  tenantId: string;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { data: list, reload } = useApi<EsteticistaRow[]>(user?.role === "ADMIN" ? "/api/admin/esteticistas" : null);
  const { data: hooks, reload: reloadHooks } = useApi<WebhookRow[]>(
    user?.role === "ADMIN" ? "/api/admin/webhooks" : null
  );
  const { data: events } = useApi<EventRow[]>(user?.role === "ADMIN" ? "/api/admin/events" : null);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [hook, setHook] = useState({ name: "", url: "", events: "*" });
  const [waKey, setWaKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");

  if (user && user.role !== "ADMIN") {
    return (
      <AppShell>
        <p>Acesso restrito à administradora.</p>
      </AppShell>
    );
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/esteticistas", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", password: "", phone: "" });
      await reload();
      toast({ title: "Esteticista criada" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível criar", description: message, variant: "destructive" });
    }
  }

  async function createHook(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/admin/webhooks", { method: "POST", body: JSON.stringify(hook) });
      setHook({ name: "", url: "", events: "*" });
      await reloadHooks();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Webhook inválido", description: message, variant: "destructive" });
    }
  }

  async function saveIntegration(key: string, value: string) {
    try {
      await api("/api/admin/integrations", { method: "PUT", body: JSON.stringify({ key, value }) });
      toast({ title: "Credencial salva" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível salvar", description: message, variant: "destructive" });
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Administração</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Infraestrutura global. Mensagens e fichas de anamnese das esteticistas permanecem isoladas.
      </p>
      <Tabs defaultValue="contas">
        <TabsList>
          <TabsTrigger value="contas">Esteticistas</TabsTrigger>
          <TabsTrigger value="apis">Integrações</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
        </TabsList>
        <TabsContent value="contas" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Nova conta</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createUser} className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit">Criar workspace</Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {(list ?? []).map((u) => (
              <Card key={u.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    <p className="text-xs">
                      {u._count.patients} pacientes · {u._count.appointments} agendamentos
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await api(`/api/admin/esteticistas/${u.id}`, { method: "DELETE" });
                      await reload();
                    }}
                  >
                    Excluir
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="apis">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Chaves globais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>WhatsApp Business API token</Label>
                <div className="flex gap-2">
                  <Input value={waKey} onChange={(e) => setWaKey(e.target.value)} placeholder="EAAG..." />
                  <Button onClick={() => void saveIntegration("WHATSAPP_TOKEN", waKey)}>Salvar</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Google OAuth client secret</Label>
                <div className="flex gap-2">
                  <Input value={googleKey} onChange={(e) => setGoogleKey(e.target.value)} placeholder="GOCSPX-..." />
                  <Button onClick={() => void saveIntegration("GOOGLE_CLIENT_SECRET", googleKey)}>Salvar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="webhooks" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Novo webhook (n8n)</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createHook} className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={hook.name} onChange={(e) => setHook({ ...hook, name: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label>URL</Label>
                  <Input value={hook.url} onChange={(e) => setHook({ ...hook, url: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label>Eventos</Label>
                  <Input value={hook.events} onChange={(e) => setHook({ ...hook, events: e.target.value })} />
                </div>
                <Button type="submit">Registrar</Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {(hooks ?? []).map((h) => (
              <Card key={h.id}>
                <CardContent className="p-4 text-sm">
                  <p className="font-medium">{h.name}</p>
                  <p className="truncate text-muted-foreground">{h.url}</p>
                  <p className="text-xs">{h.events}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="eventos">
          <div className="space-y-2">
            {(events ?? []).map((ev) => (
              <Card key={ev.id}>
                <CardContent className="p-3 text-xs">
                  <p className="font-medium">{ev.type}</p>
                  <p className="text-muted-foreground">{new Date(ev.createdAt).toLocaleString("pt-BR")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

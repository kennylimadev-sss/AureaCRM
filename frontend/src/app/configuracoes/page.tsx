"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";

interface ApiTokenResponse {
  token: string | null;
  endpoint: string;
  updatedAt: string | null;
}

export default function ConfigPage() {
  const { user } = useAuth();
  const canManageToken = user?.role === "ESTETICISTA" || user?.role === "ADMIN";
  const { data, reload } = useApi<ApiTokenResponse>(
    canManageToken ? "/api/integrations/api-token" : null
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      await api<ApiTokenResponse>("/api/integrations/api-token", { method: "POST" });
      await reload();
      toast({ title: "Token de API gerado" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível gerar", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    try {
      await api("/api/integrations/api-token", { method: "DELETE" });
      await reload();
      toast({ title: "Token revogado" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível revogar", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    if (!data?.token) return;
    try {
      await navigator.clipboard.writeText(data.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  const token = data?.token ?? null;

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Integrações</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{user?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{user?.email}</p>
            <p>Perfil: {user?.role === "ADMIN" ? "Administradora" : "Esteticista"}</p>
            <p className="text-muted-foreground">
              Dados clínicos e conversas ficam isolados no seu workspace. Webhooks de saída são
              configurados pela administradora.
            </p>
          </CardContent>
        </Card>

        {canManageToken ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                API de entrada (Inbound)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use este Bearer Token para enviar leads do n8n, Postman ou landing pages para o CRM.
              </p>
              <div className="space-y-1">
                <Label>Token de API</Label>
                <div className="flex gap-2">
                  <Input readOnly value={token ?? "Nenhum token gerado"} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => void copyToken()} disabled={!token}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {data?.updatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void generate()} disabled={busy}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {token ? "Gerar novo" : "Gerar token"}
                </Button>
                {token ? (
                  <Button variant="outline" onClick={() => void revoke()} disabled={busy}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Revogar
                  </Button>
                ) : null}
              </div>
              <div className="rounded-xl border bg-muted/40 p-3 text-xs">
                <p className="font-medium">Endpoint</p>
                <code className="text-[11px]">POST {data?.endpoint ?? "/api/v1/leads"}</code>
                <p className="mt-2 font-medium">Headers</p>
                <code className="text-[11px]">Authorization: Bearer &lt;token&gt;</code>
                <p className="mt-2 font-medium">Corpo (JSON)</p>
                <pre className="mt-1 overflow-auto rounded-lg bg-background p-2 text-[11px] leading-relaxed">{`{
  "nome": "Maria Souza",
  "telefone": "11999998888",
  "email": "maria@exemplo.com",
  "procedimento_interesse": "Limpeza de pele",
  "origem": "landing-page",
  "status_kanban": "Novo lead",
  "observacoes": "Prefere manhã"
}`}</pre>
                <p className="mt-2 text-muted-foreground">
                  Se o telefone ou e-mail já existir, o cadastro é atualizado e a API responde 200.
                  Novo lead responde 201 com o ID gerado.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {canManageToken ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Webhooks de saída</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Os eventos enviados para as URLs cadastradas incluem as variáveis do cliente:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "id_cliente",
                  "nome_completo",
                  "telefone_whatsapp",
                  "email",
                  "procedimento",
                  "servico",
                  "esteticista_responsavel",
                  "status_kanban",
                  "data_agendamento",
                  "origem_lead",
                ].map((k) => (
                  <code key={k} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    {k}
                  </code>
                ))}
              </div>
              <p className="text-xs">
                Eventos: <code>patient.created</code>, <code>patient.updated</code>,{" "}
                <code>kanban.lead.moved</code>, <code>appointment.created</code>,{" "}
                <code>appointment.updated</code>, <code>appointment.deleted</code>.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

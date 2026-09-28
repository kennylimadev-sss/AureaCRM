"use client";

import { FormEvent, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/useApi";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { formatTime, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Conversation, Message, WhatsAppStatus } from "@/lib/types";

export default function WhatsAppPage() {
  const { data: status, reload: reloadStatus } = useApi<WhatsAppStatus>("/api/whatsapp/status");
  const { data: conversations, reload: reloadConv } = useApi<Conversation[]>("/api/messages/conversations");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: messages, reload: reloadMsg } = useApi<Message[]>(
    selectedId ? `/api/messages/patient/${selectedId}` : null,
    [selectedId]
  );
  const [text, setText] = useState("");
  const [provider, setProvider] = useState<"WEB" | "OFFICIAL">("WEB");

  const selected = useMemo(
    () => (conversations ?? []).find((c) => c.patient.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  async function connect() {
    try {
      await api("/api/whatsapp/connect", { method: "POST", body: JSON.stringify({ provider }) });
      toast({ title: "QR gerado", description: "Simulação: a sessão conecta em alguns segundos." });
      setTimeout(() => void reloadStatus(), 4000);
      await reloadStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível conectar", description: message, variant: "destructive" });
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !text.trim()) return;
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ patientId: selectedId, content: text }),
      });
      setText("");
      await reloadMsg();
      await reloadConv();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Mensagem não enviada", description: message, variant: "destructive" });
    }
  }

  async function simulateInbound() {
    if (!selectedId) return;
    try {
      await api("/api/messages/simulate-inbound", {
        method: "POST",
        body: JSON.stringify({ patientId: selectedId, content: "Oi! Confirmo o horário, obrigada." }),
      });
      await reloadMsg();
      await reloadConv();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Falha na simulação", description: message, variant: "destructive" });
    }
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">Web não-oficial ou API oficial — sessão no backend.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-xl border bg-card px-3 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "WEB" | "OFFICIAL")}
          >
            <option value="WEB">WhatsApp Web</option>
            <option value="OFFICIAL">Business API</option>
          </select>
          {status?.status === "CONNECTED" ? (
            <Button
              variant="outline"
              onClick={async () => {
                await api("/api/whatsapp/disconnect", { method: "POST" });
                await reloadStatus();
              }}
            >
              Desconectar
            </Button>
          ) : (
            <Button onClick={() => void connect()}>Gerar QR</Button>
          )}
          <Badge variant={status?.status === "CONNECTED" ? "secondary" : "outline"}>
            {status?.status ?? "DISCONNECTED"}
          </Badge>
        </div>
      </div>
      {status?.status === "QR_READY" && status.qrCode ? (
        <Card className="mb-4 max-w-xs">
          <CardContent className="p-4">
            <p className="mb-2 text-sm">Escaneie com o WhatsApp</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={status.qrCode} alt="QR Code WhatsApp" className="rounded-xl" />
          </CardContent>
        </Card>
      ) : null}
      <div className="grid h-[calc(100vh-220px)] min-h-[420px] overflow-hidden rounded-2xl border bg-card md:grid-cols-[280px_1fr]">
        <aside className="border-r">
          {(conversations ?? []).map((c) => (
            <button
              key={c.patient.id}
              onClick={() => setSelectedId(c.patient.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b px-3 py-3 text-left hover:bg-muted/60",
                selectedId === c.patient.id && "bg-muted"
              )}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials(c.patient.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.patient.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.lastMessage?.content ?? "Sem mensagens"}</p>
              </div>
            </button>
          ))}
        </aside>
        <section className="flex flex-col">
          {selected ? (
            <>
              <header className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="font-medium">{selected.patient.name}</p>
                  <p className="text-xs text-muted-foreground">{selected.patient.phone}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void simulateInbound()}>
                  Simular resposta
                </Button>
              </header>
              <div className="flex-1 space-y-2 overflow-auto p-4">
                {(messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                      m.direction === "OUTBOUND" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <p>{m.content}</p>
                    <p className="mt-1 text-[10px] opacity-70">{formatTime(m.timestamp)}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="flex gap-2 border-t p-3">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem" />
                <Button type="submit">Enviar</Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

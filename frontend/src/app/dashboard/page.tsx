"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/useApi";
import type { DashboardData } from "@/lib/types";
import { formatTime } from "@/lib/utils";

export default function DashboardPage() {
  const { data, loading } = useApi<DashboardData>("/api/dashboard");

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Bom atendimento</h1>
        <p className="text-sm text-muted-foreground">Resumo do seu workspace isolado.</p>
      </div>
      {loading || !data ? (
        <p className="text-muted-foreground">Carregando indicadores...</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Pacientes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{data.patients}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Agenda no mês</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{data.monthAppointments}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">WhatsApp</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={data.whatsapp === "CONNECTED" ? "secondary" : "outline"}>
                  {data.whatsapp === "CONNECTED" ? "Conectado" : "Desconectado"}
                </Badge>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Hoje na agenda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.todayAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum horário para hoje.</p>
                ) : (
                  data.todayAppointments.map((apt) => (
                    <div key={apt.id} className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{apt.patient?.name}</p>
                        <p className="text-xs text-muted-foreground">{apt.procedure?.name ?? "Atendimento"}</p>
                      </div>
                      <span className="text-sm">{formatTime(apt.startTime)}</span>
                    </div>
                  ))
                )}
                <Link href="/agenda" className="text-sm text-primary hover:underline">
                  Abrir agenda
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Funil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.funnel.map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="text-sm">{s.name}</span>
                    </div>
                    <span className="text-sm font-medium">{s.count}</span>
                  </div>
                ))}
                <Link href="/funil" className="text-sm text-primary hover:underline">
                  Ver quadro
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

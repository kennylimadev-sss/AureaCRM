"use client";

import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BodyMap } from "@/components/clinical/BodyMap";
import { useApi } from "@/hooks/useApi";
import { api, apiUpload, ApiError } from "@/lib/api";
import { toast } from "@/components/ui/use-toast";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  AnamnesisForm,
  BodyRegion,
  ClinicalEvolution,
  Patient,
  Procedure,
} from "@/lib/types";

export default function PacienteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: patient, reload } = useApi<Patient>(`/api/patients/${id}`);
  const { data: procedures } = useApi<Procedure[]>("/api/procedures");
  const { data: regions } = useApi<BodyRegion[]>("/api/evolutions/regions");
  const [anamnese, setAnamnese] = useState({
    healthHistory: "",
    allergies: "",
    medications: "",
    skinType: "",
    lifestyle: "",
    complaints: "",
  });
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedEvo, setSelectedEvo] = useState<ClinicalEvolution | null>(null);

  async function saveAnamnese(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/anamnesis", {
        method: "POST",
        body: JSON.stringify({ patientId: id, ...anamnese, signedAt: new Date().toISOString() }),
      });
      toast({ title: "Anamnese salva" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível salvar", description: message, variant: "destructive" });
    }
  }

  async function uploadAttachment(file: File, formId?: string) {
    try {
      const uploaded = await apiUpload(file);
      if (formId) {
        await api(`/api/anamnesis/${formId}`, {
          method: "PUT",
          body: JSON.stringify({ attachmentUrl: uploaded.url }),
        });
      } else {
        await api("/api/anamnesis", {
          method: "POST",
          body: JSON.stringify({ patientId: id, attachmentUrl: uploaded.url }),
        });
      }
      toast({ title: "Documento anexado" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha no upload";
      toast({ title: "Upload falhou", description: message, variant: "destructive" });
    }
  }

  async function createEvolution() {
    try {
      await api("/api/evolutions", {
        method: "POST",
        body: JSON.stringify({
          patientId: id,
          sessionDate: new Date().toISOString(),
          generalNotes: sessionNotes,
          markings: [],
        }),
      });
      setSessionNotes("");
      toast({ title: "Sessão registrada" });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Não foi possível registrar", description: message, variant: "destructive" });
    }
  }

  async function addMarking(
    evolutionId: string,
    payload: {
      bodyRegion: string;
      view: "front" | "back" | "face";
      procedureId: string | null;
      specificNotes: string;
      posX: number;
      posY: number;
    }
  ) {
    try {
      await api(`/api/evolutions/${evolutionId}/markings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await reload();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha";
      toast({ title: "Marcação não salva", description: message, variant: "destructive" });
    }
  }

  if (!patient) {
    return (
      <AppShell>
        <p className="text-muted-foreground">Carregando prontuário...</p>
      </AppShell>
    );
  }

  const latestEvo = patient.evolutions?.[0];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{patient.name}</h1>
        <p className="text-sm text-muted-foreground">
          {patient.phone} {patient.email ? `· ${patient.email}` : ""}
        </p>
      </div>
      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="anamnese">Anamnese</TabsTrigger>
          <TabsTrigger value="mapa">Mapa corporal</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Origem: {patient.source ?? "—"}</p>
                <p>Endereço: {patient.address ?? "—"}</p>
                <p>Notas: {patient.notes ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Próximos horários</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(patient.appointments ?? []).slice(0, 4).map((a) => (
                  <p key={a.id}>
                    {formatDateTime(a.startTime)} · {a.procedure?.name ?? "Atendimento"}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="anamnese">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ficha digital</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveAnamnese} className="space-y-3">
                  <Field label="Histórico de saúde" value={anamnese.healthHistory} onChange={(v) => setAnamnese({ ...anamnese, healthHistory: v })} />
                  <Field label="Alergias" value={anamnese.allergies} onChange={(v) => setAnamnese({ ...anamnese, allergies: v })} />
                  <Field label="Medicamentos" value={anamnese.medications} onChange={(v) => setAnamnese({ ...anamnese, medications: v })} />
                  <div className="space-y-1">
                    <Label>Tipo de pele</Label>
                    <Input value={anamnese.skinType} onChange={(e) => setAnamnese({ ...anamnese, skinType: e.target.value })} />
                  </div>
                  <Field label="Hábitos" value={anamnese.lifestyle} onChange={(v) => setAnamnese({ ...anamnese, lifestyle: v })} />
                  <Field label="Queixas" value={anamnese.complaints} onChange={(v) => setAnamnese({ ...anamnese, complaints: v })} />
                  <Button type="submit">Salvar ficha</Button>
                </form>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload da ficha física</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAttachment(file);
                    }}
                  />
                </CardContent>
              </Card>
              {(patient.anamnesis ?? []).map((f: AnamnesisForm) => (
                <Card key={f.id}>
                  <CardHeader>
                    <CardTitle className="text-sm">{formatDate(f.createdAt)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Alergias: {f.allergies ?? "—"}</p>
                    <p>Queixas: {f.complaints ?? "—"}</p>
                    {f.attachmentUrl ? (
                      <a className="text-primary underline" href={f.attachmentUrl} target="_blank" rel="noreferrer">
                        Ver anexo
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="mapa">
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Marcar sessão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Notas gerais da sessão"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                />
                <Button onClick={() => void createEvolution()}>Abrir sessão de hoje</Button>
                <p className="text-xs text-muted-foreground">
                  Depois de abrir a sessão, clique nas regiões para registrar procedimentos.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <BodyMap
                  regions={regions ?? []}
                  markings={latestEvo?.markings ?? []}
                  procedures={procedures ?? []}
                  interactive={Boolean(latestEvo)}
                  onAdd={latestEvo ? (payload) => addMarking(latestEvo.id, payload) : undefined}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="evolucao">
          <div className="space-y-3">
            {(patient.evolutions ?? []).map((evo) => (
              <button
                key={evo.id}
                className="w-full rounded-2xl border bg-card p-4 text-left shadow-sm hover:shadow-card"
                onClick={() => setSelectedEvo(evo)}
              >
                <p className="font-medium">{formatDate(evo.sessionDate)}</p>
                <p className="text-sm text-muted-foreground">{evo.generalNotes ?? "Sem notas gerais"}</p>
                <p className="mt-1 text-xs text-primary">{evo.markings.length} marcações no mapa</p>
              </button>
            ))}
          </div>
          <Dialog open={Boolean(selectedEvo)} onOpenChange={(o) => !o && setSelectedEvo(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  Sessão {selectedEvo ? formatDate(selectedEvo.sessionDate) : ""}
                </DialogTitle>
              </DialogHeader>
              {selectedEvo ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <p className="text-sm md:col-span-2">{selectedEvo.generalNotes}</p>
                  <BodyMap
                    regions={regions ?? []}
                    markings={selectedEvo.markings}
                    procedures={procedures ?? []}
                  />
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

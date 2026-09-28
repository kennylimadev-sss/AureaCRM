"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BodyMapMarking, BodyRegion, Procedure } from "@/lib/types";

interface BodyMapProps {
  regions: BodyRegion[];
  markings: BodyMapMarking[];
  procedures: Procedure[];
  interactive?: boolean;
  onAdd?: (payload: {
    bodyRegion: string;
    view: "front" | "back" | "face";
    procedureId: string | null;
    specificNotes: string;
    posX: number;
    posY: number;
  }) => Promise<void>;
  highlightView?: "front" | "back" | "face";
}

const VIEWS: Array<{ id: "front" | "back" | "face"; label: string }> = [
  { id: "front", label: "Frente" },
  { id: "back", label: "Costas" },
  { id: "face", label: "Rosto" },
];

export function BodyMap({ regions, markings, procedures, interactive, onAdd }: BodyMapProps) {
  const [view, setView] = useState<"front" | "back" | "face">("front");
  const [selected, setSelected] = useState<BodyRegion | null>(null);
  const [procedureId, setProcedureId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const viewRegions = useMemo(() => regions.filter((r) => r.view === view), [regions, view]);
  const viewMarkings = useMemo(() => markings.filter((m) => m.view === view), [markings, view]);

  async function confirm() {
    if (!selected || !onAdd) return;
    await onAdd({
      bodyRegion: selected.id,
      view: selected.view,
      procedureId: procedureId || null,
      specificNotes: notes,
      posX: selected.cx,
      posY: selected.cy,
    });
    setSelected(null);
    setNotes("");
    setProcedureId("");
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {VIEWS.map((v) => (
          <Button key={v.id} size="sm" variant={view === v.id ? "default" : "outline"} onClick={() => setView(v.id)}>
            {v.label}
          </Button>
        ))}
      </div>
      <div className="relative mx-auto aspect-[3/5] w-full max-w-[280px] rounded-2xl bg-muted/70">
        <Silhouette view={view} />
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {viewRegions.map((r) => {
            const marked = viewMarkings.some((m) => m.bodyRegion === r.id);
            return (
              <circle
                key={r.id}
                cx={r.cx}
                cy={r.cy}
                r={r.r}
                className={
                  marked
                    ? "fill-primary/70 stroke-primary cursor-pointer"
                    : "fill-transparent stroke-primary/40 cursor-pointer hover:fill-primary/20"
                }
                strokeWidth={0.8}
                onClick={() => {
                  if (interactive) setSelected(r);
                }}
              >
                <title>{r.label}</title>
              </circle>
            );
          })}
          {viewMarkings.map((m) => (
            <circle key={m.id} cx={m.posX || 50} cy={m.posY || 50} r={2.2} className="fill-terracotta" />
          ))}
        </svg>
      </div>
      {viewMarkings.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {viewMarkings.map((m) => (
            <li key={m.id} className="rounded-xl bg-muted/60 px-3 py-2">
              <p className="font-medium">{regions.find((r) => r.id === m.bodyRegion)?.label ?? m.bodyRegion}</p>
              <p className="text-xs text-muted-foreground">
                {m.procedure?.name ?? "Procedimento"} {m.specificNotes ? `— ${m.specificNotes}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Procedimento</Label>
              <select
                className="flex h-10 w-full rounded-xl border bg-card px-3 text-sm"
                value={procedureId}
                onChange={(e) => setProcedureId(e.target.value)}
              >
                <option value="">Selecionar</option>
                {procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Anotações da região</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => void confirm()}>
              Registrar marcação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Silhouette({ view }: { view: "front" | "back" | "face" }) {
  if (view === "face") {
    return (
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-nude">
        <ellipse cx="50" cy="52" rx="28" ry="36" fill="currentColor" opacity="0.55" />
        <ellipse cx="50" cy="18" rx="18" ry="8" fill="currentColor" opacity="0.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full text-nude">
      <circle cx="50" cy="10" r="6" fill="currentColor" opacity="0.7" />
      <rect x="38" y="16" width="24" height="28" rx="10" fill="currentColor" opacity="0.55" />
      <rect x="22" y="18" width="10" height="28" rx="5" fill="currentColor" opacity="0.5" />
      <rect x="68" y="18" width="10" height="28" rx="5" fill="currentColor" opacity="0.5" />
      <rect x="40" y="44" width="8" height="36" rx="4" fill="currentColor" opacity="0.5" />
      <rect x="52" y="44" width="8" height="36" rx="4" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

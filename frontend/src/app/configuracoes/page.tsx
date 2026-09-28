"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export default function ConfigPage() {
  const { user } = useAuth();
  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Conta</h1>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{user?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{user?.email}</p>
          <p>Perfil: {user?.role === "ADMIN" ? "Administradora" : "Esteticista"}</p>
          <p className="text-muted-foreground">
            Dados clínicos e conversas ficam isolados no seu tenant. Chaves de API e webhooks são gerenciados
            apenas pela administradora.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}

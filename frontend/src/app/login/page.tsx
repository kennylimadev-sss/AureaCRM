"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("hannah.h@example.com");
  const [password, setPassword] = useState("estetica123");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await login(email, password);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Falha no login";
      toast({ title: "Não foi possível entrar", description: message, variant: "destructive" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-graphite lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-terracotta/40 via-graphite to-sage/30" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-cream">
          <p className="text-sm tracking-[0.3em] uppercase">Lumina Estética</p>
          <div>
            <h1 className="max-w-md text-4xl font-semibold leading-tight">
              O consultório, o funil e o WhatsApp em um só lugar.
            </h1>
            <p className="mt-4 max-w-sm text-cream/80">
              CRM, prontuário eletrônico com mapa corporal e agenda sincronizada — com a calma de um spa e a
              precisão de um SaaS.
            </p>
          </div>
          <p className="text-xs text-cream/60">Multi-tenant · Isolamento por esteticista · V1</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Use a conta demo da esteticista ou da administradora.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Entrando..." : "Acessar workspace"}
              </Button>
            </form>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <p>Esteticista: hannah.h@example.com / estetica123</p>
              <p>Admin: xena.w@example.org / admin123</p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Nova profissional?{" "}
              <Link href="/cadastro" className="text-primary underline-offset-4 hover:underline">
                Criar conta
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

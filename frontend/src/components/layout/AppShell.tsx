"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTheme } from "next-themes";
import {
  CalendarDays,
  LayoutDashboard,
  KanbanSquare,
  MessageCircle,
  Users,
  Sparkles,
  Settings,
  LogOut,
  Moon,
  Sun,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/funil", label: "Funil", icon: KanbanSquare },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/procedimentos", label: "Procedimentos", icon: Sparkles },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando workspace...
      </div>
    );
  }

  const items = user.role === "ADMIN" ? [...nav, { href: "/admin", label: "Admin", icon: Shield }] : nav;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r bg-card/70 p-5 md:flex md:flex-col">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-semibold">
            L
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Lumina Estética</p>
            <p className="text-xs text-muted-foreground">Gestão & CRM</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.role === "ADMIN" ? "Administradora" : "Esteticista"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href="/configuracoes">
                <Settings className="mr-2 h-4 w-4" />
                Conta
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/60 px-4 py-3 md:hidden">
          <p className="font-semibold">Lumina</p>
          <Button variant="ghost" size="sm" onClick={logout}>
            Sair
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
        <nav className="grid grid-cols-5 border-t bg-card p-2 md:hidden">
          {nav.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-1 text-[10px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

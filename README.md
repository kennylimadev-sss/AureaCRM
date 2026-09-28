# Lumina Estética

SaaS de gestão para profissionais de estética: CRM/funil, WhatsApp, prontuário eletrônico com mapa corporal e agenda com Google Calendar.

## Stack

- Frontend: Next.js 14 (App Router), TypeScript, Tailwind, Shadcn UI
- Backend: Node.js + Express, Prisma, SQLite (dev) / PostgreSQL (prod)
- Realtime: Socket.IO

## Contas demo

- Esteticista: `hannah.h@example.com` / `estetica123`
- Admin: `xena.w@example.org` / `admin123`

## Desenvolvimento

```bash
# Instalar dependências
npm install --prefix backend
npm install --prefix frontend

# Banco e seed
npm run db:generate --prefix backend
npm run db:push --prefix backend
npm run db:seed --prefix backend

# Backend (porta 3001)
npm run dev --prefix backend

# Frontend (porta 3000, proxy /api -> 3001)
npm run dev --prefix frontend
```

Ou `bash start.sh`.

## Multi-tenant

Todas as tabelas de negócio usam `tenantId`. O JWT carrega `userId`/`tenantId`/`role`. Esteticistas só acessam o próprio workspace. O Admin gerencia contas, chaves de API e webhooks, sem abrir fichas clínicas pelo painel.

## Produção (VPS)

Troque `DATABASE_URL` para PostgreSQL, configure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` e rode backend + frontend com PM2.

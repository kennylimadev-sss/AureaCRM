import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "xena.w@example.org").toLowerCase();
  const demoEmail = (process.env.DEMO_EMAIL ?? "hannah.h@example.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const demoPassword = process.env.DEMO_PASSWORD ?? "estetica123";

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const demoHash = await bcrypt.hash(demoPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, name: "Administradora Luna" },
    create: {
      name: "Administradora Luna",
      email: adminEmail,
      passwordHash: adminHash,
      role: "ADMIN",
      phone: "+55 11 90000-0001",
    },
  });

  const esteticista = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { passwordHash: demoHash, name: "Marina Alves" },
    create: {
      name: "Marina Alves",
      email: demoEmail,
      passwordHash: demoHash,
      role: "ESTETICISTA",
      phone: "+55 11 98888-0101",
    },
  });

  const tenantId = esteticista.id;

  await prisma.kanbanStage.deleteMany({ where: { tenantId } });
  const stages = await Promise.all([
    prisma.kanbanStage.create({
      data: { tenantId, name: "Novo lead", orderIndex: 0, color: "#D8BCAE" },
    }),
    prisma.kanbanStage.create({
      data: { tenantId, name: "Em contato", orderIndex: 1, color: "#C98D71" },
    }),
    prisma.kanbanStage.create({
      data: { tenantId, name: "Agendado", orderIndex: 2, color: "#9AAB95" },
    }),
    prisma.kanbanStage.create({
      data: { tenantId, name: "Cliente", orderIndex: 3, color: "#7D8B74" },
    }),
  ]);

  await prisma.procedure.deleteMany({ where: { tenantId } });
  const [limpeza, peeling, drenagem, botox, massagem] = await Promise.all([
    prisma.procedure.create({
      data: {
        tenantId,
        name: "Limpeza de pele profunda",
        description: "Extração, hidratação e máscara calmante.",
        durationMinutes: 75,
        price: 280,
        color: "#C98D71",
      },
    }),
    prisma.procedure.create({
      data: {
        tenantId,
        name: "Peeling enzimático",
        description: "Renovação celular com enzimas vegetais.",
        durationMinutes: 50,
        price: 320,
        color: "#D8BCAE",
      },
    }),
    prisma.procedure.create({
      data: {
        tenantId,
        name: "Drenagem linfática",
        description: "Protocolo corporal pós-operatório ou retenção.",
        durationMinutes: 60,
        price: 220,
        color: "#9AAB95",
      },
    }),
    prisma.procedure.create({
      data: {
        tenantId,
        name: "Protocolo lifting facial",
        description: "Radiofrequência e drenagem facial.",
        durationMinutes: 80,
        price: 450,
        color: "#B08968",
      },
    }),
    prisma.procedure.create({
      data: {
        tenantId,
        name: "Massagem modeladora",
        description: "Foco em abdômen, flancos e glúteos.",
        durationMinutes: 50,
        price: 190,
        color: "#A98467",
      },
    }),
  ]);

  await prisma.patient.deleteMany({ where: { tenantId } });

  const ana = await prisma.patient.create({
    data: {
      tenantId,
      name: "Ana Beatriz Costa",
      phone: "+55 11 99111-2233",
      email: "ana.costa@email.com",
      notes: "Prefere horários pela manhã. Pele mista com acne residual.",
      birthDate: new Date("1994-03-12"),
      address: "Vila Madalena, São Paulo",
      stageId: stages[3].id,
      source: "Instagram",
    },
  });
  const clara = await prisma.patient.create({
    data: {
      tenantId,
      name: "Clara Mendes",
      phone: "+55 11 98765-4321",
      email: "clara.mendes@email.com",
      notes: "Interessada em protocolo de lifting.",
      birthDate: new Date("1988-07-21"),
      stageId: stages[2].id,
      source: "Indicação",
    },
  });
  const julia = await prisma.patient.create({
    data: {
      tenantId,
      name: "Júlia Prado",
      phone: "+55 21 99876-1100",
      email: "julia.prado@email.com",
      notes: "Primeiro contato via WhatsApp.",
      stageId: stages[1].id,
      source: "WhatsApp",
    },
  });
  const fernanda = await prisma.patient.create({
    data: {
      tenantId,
      name: "Fernanda Lima",
      phone: "+55 11 97654-8899",
      email: "fernanda.lima@email.com",
      notes: "Lead de campanha de peeling.",
      stageId: stages[0].id,
      source: "Google",
    },
  });
  const helena = await prisma.patient.create({
    data: {
      tenantId,
      name: "Helena Duarte",
      phone: "+55 11 91234-5566",
      email: "helena.duarte@email.com",
      notes: "Pós-operatório de lipo. Foco em drenagem.",
      birthDate: new Date("1990-11-02"),
      stageId: stages[3].id,
      source: "Indicação médica",
    },
  });

  const now = new Date();
  const todayAt = (h: number, m: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const daysFromNow = (d: number, h: number, m: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m);

  await prisma.appointment.createMany({
    data: [
      {
        tenantId,
        patientId: ana.id,
        procedureId: limpeza.id,
        startTime: todayAt(10, 0),
        endTime: todayAt(11, 15),
        status: "CONFIRMED",
        notes: "Trazer protetor solar.",
      },
      {
        tenantId,
        patientId: helena.id,
        procedureId: drenagem.id,
        startTime: todayAt(14, 30),
        endTime: todayAt(15, 30),
        status: "SCHEDULED",
      },
      {
        tenantId,
        patientId: clara.id,
        procedureId: botox.id,
        startTime: daysFromNow(1, 9, 0),
        endTime: daysFromNow(1, 10, 20),
        status: "SCHEDULED",
      },
      {
        tenantId,
        patientId: julia.id,
        procedureId: peeling.id,
        startTime: daysFromNow(2, 16, 0),
        endTime: daysFromNow(2, 16, 50),
        status: "SCHEDULED",
      },
      {
        tenantId,
        patientId: fernanda.id,
        procedureId: massagem.id,
        startTime: daysFromNow(4, 11, 0),
        endTime: daysFromNow(4, 11, 50),
        status: "SCHEDULED",
      },
    ],
  });

  await prisma.anamnesisForm.create({
    data: {
      tenantId,
      patientId: ana.id,
      healthHistory: "Sem doenças crônicas. Já realizou extração de cravos.",
      allergies: "Nega alergias conhecidas.",
      medications: "Anticoncepcional oral.",
      skinType: "Mista, tendência a oleosidade na zona T.",
      lifestyle: "Bebe 1,5L de água/dia. Usa protetor solar irregularmente.",
      complaints: "Poros dilatados e manchas pós-inflamatórias.",
      signedAt: new Date(),
    },
  });

  await prisma.anamnesisForm.create({
    data: {
      tenantId,
      patientId: helena.id,
      healthHistory: "Lipoaspiração há 21 dias.",
      allergies: "Látex.",
      medications: "Analgésico sob demanda.",
      skinType: "Normal",
      lifestyle: "Repouso relativo, caminhadas leves.",
      complaints: "Edema em flancos e abdômen.",
      signedAt: new Date(),
    },
  });

  const evoAna = await prisma.clinicalEvolution.create({
    data: {
      tenantId,
      patientId: ana.id,
      sessionDate: daysFromNow(-14, 10, 0),
      generalNotes: "Pele reativa após extração. Aplicada máscara calmante de centella.",
    },
  });
  await prisma.bodyMapMarking.createMany({
    data: [
      {
        evolutionId: evoAna.id,
        tenantId,
        procedureId: limpeza.id,
        bodyRegion: "face_cheeks",
        view: "face",
        specificNotes: "Extração de comedões nas maçãs do rosto.",
        posX: 50,
        posY: 52,
      },
      {
        evolutionId: evoAna.id,
        tenantId,
        procedureId: limpeza.id,
        bodyRegion: "face_forehead",
        view: "face",
        specificNotes: "Hidratação e altas em poros.",
        posX: 50,
        posY: 18,
      },
    ],
  });

  const evoHelena = await prisma.clinicalEvolution.create({
    data: {
      tenantId,
      patientId: helena.id,
      sessionDate: daysFromNow(-7, 14, 0),
      generalNotes: "Boa resposta à drenagem. Redução visível de edema em flanco direito.",
    },
  });
  await prisma.bodyMapMarking.createMany({
    data: [
      {
        evolutionId: evoHelena.id,
        tenantId,
        procedureId: drenagem.id,
        bodyRegion: "front_abdomen",
        view: "front",
        specificNotes: "Manobras de captação em sentido horário.",
        posX: 50,
        posY: 38,
      },
      {
        evolutionId: evoHelena.id,
        tenantId,
        procedureId: drenagem.id,
        bodyRegion: "front_pelvis",
        view: "front",
        specificNotes: "Leve desconforto relatado, pressão reduzida.",
        posX: 50,
        posY: 50,
      },
    ],
  });

  await prisma.message.createMany({
    data: [
      {
        tenantId,
        patientId: ana.id,
        direction: "INBOUND",
        content: "Oi Marina! Confirmo o horário de amanhã às 10h.",
        timestamp: daysFromNow(-1, 18, 12),
      },
      {
        tenantId,
        patientId: ana.id,
        direction: "OUTBOUND",
        content: "Perfeito, Ana. Te espero às 10h. Traga o protetor solar.",
        timestamp: daysFromNow(-1, 18, 14),
      },
      {
        tenantId,
        patientId: clara.id,
        direction: "INBOUND",
        content: "Ainda tem vaga para o lifting na quinta?",
        timestamp: daysFromNow(-2, 11, 40),
      },
      {
        tenantId,
        patientId: clara.id,
        direction: "OUTBOUND",
        content: "Tenho 9h. Posso reservar para você?",
        timestamp: daysFromNow(-2, 11, 45),
      },
      {
        tenantId,
        patientId: julia.id,
        direction: "INBOUND",
        content: "Vi o peeling no Instagram. Qual o valor?",
        timestamp: daysFromNow(0, 8, 5),
      },
    ],
  });

  await prisma.whatsAppSession.upsert({
    where: { tenantId },
    update: { status: "DISCONNECTED", provider: "WEB" },
    create: { tenantId, status: "DISCONNECTED", provider: "WEB" },
  });

  await prisma.webhook.create({
    data: {
      tenantId: admin.id,
      name: "n8n — novos leads",
      url: "https://n8n.example.com/webhook/estetica",
      events: "patient.created,kanban.lead.moved,appointment.created",
      secret: "demo-secret",
      active: false,
    },
  });

  console.log("Seed ok");
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Esteticista: ${demoEmail} / ${demoPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

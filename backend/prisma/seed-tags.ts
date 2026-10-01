import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: "hannah.h@example.com" } });
  if (!user) {
    throw new Error("demo user missing");
  }
  const tenantId = user.id;
  const defs = [
    { name: "Confirmada", color: "#9AAB95" },
    { name: "Primeira visita", color: "#C98D71" },
    { name: "Pós-operatório", color: "#D8BCAE" },
    { name: "Retorno", color: "#7D8B74" },
  ];
  const tags = [];
  for (const d of defs) {
    const t = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId, name: d.name } },
      update: { color: d.color },
      create: { tenantId, ...d },
    });
    tags.push(t);
  }
  const apts = await prisma.appointment.findMany({
    where: { tenantId },
    orderBy: { startTime: "asc" },
  });
  const pairs: Array<[number, number[]]> = [
    [0, [0, 3]],
    [1, [2]],
    [2, [1]],
  ];
  for (const [ai, tis] of pairs) {
    const apt = apts[ai];
    if (!apt) continue;
    for (const ti of tis) {
      await prisma.appointmentTag.upsert({
        where: { appointmentId_tagId: { appointmentId: apt.id, tagId: tags[ti].id } },
        update: {},
        create: { tenantId, appointmentId: apt.id, tagId: tags[ti].id },
      });
    }
  }
  console.log("tags", tags.map((t) => t.name).join(", "), "apts", apts.length);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// prisma/seed.ts
// Run: npm run db:seed
// Seeds the Aburi → Oyarifa → Teiman → Madina pilot corridor

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Station Finder database...");

  // ── 1. Locations ──────────────────────────────────────────────────────────

  const locations = await Promise.all([
    prisma.location.upsert({
      where: { id: "loc-aburi" },
      update: {},
      create: {
        id: "loc-aburi",
        name: "Aburi Junction",
        latitude: 5.8489,
        longitude: -0.1761,
        description:
          "Main junction in Aburi town. Stand opposite the Aburi Gardens entrance — trotros to Accra load here in the morning.",
      },
    }),
    prisma.location.upsert({
      where: { id: "loc-oyarifa" },
      update: {},
      create: {
        id: "loc-oyarifa",
        name: "Oyarifa Junction",
        latitude: 5.7005,
        longitude: -0.1333,
        description:
          "Stand at the main roundabout by the Total filling station. Trotros to Madina stop on the right side heading south.",
      },
    }),
    prisma.location.upsert({
      where: { id: "loc-teiman" },
      update: {},
      create: {
        id: "loc-teiman",
        name: "Teiman Junction",
        latitude: 5.6863,
        longitude: -0.1488,
        description:
          "Stand at the T-junction near the Teiman market. Look for trotros heading toward Madina on the left side.",
      },
    }),
    prisma.location.upsert({
      where: { id: "loc-madina" },
      update: {},
      create: {
        id: "loc-madina",
        name: "Madina Station",
        latitude: 5.6833,
        longitude: -0.1667,
        description:
          "Main Madina lorry station. Large terminus — you can connect to Accra Central, Legon, and other destinations from here.",
      },
    }),
    prisma.location.upsert({
      where: { id: "loc-accra-central" },
      update: {},
      create: {
        id: "loc-accra-central",
        name: "Accra Central (Circle)",
        latitude: 5.5560,
        longitude: -0.2070,
        description:
          "Kwame Nkrumah Circle interchange. Major hub for all directions. Trotros to every part of Accra load here.",
      },
    }),
  ]);

  console.log(`✅ Seeded ${locations.length} locations`);

  // ── 2. Routes ─────────────────────────────────────────────────────────────

  const routes = await Promise.all([
    // Aburi → Oyarifa
    prisma.route.upsert({
      where: { id: "route-aburi-oyarifa" },
      update: {},
      create: {
        id: "route-aburi-oyarifa",
        originId: "loc-aburi",
        destinationId: "loc-oyarifa",
        transitType: "Trotro",
        estimatedFare: 5.0,
        whatToLookFor: "Mates shouting 'Accra! Accra!' or 'Oyarifa!' from the junction",
        durationMins: 40,
      },
    }),
    // Oyarifa → Teiman
    prisma.route.upsert({
      where: { id: "route-oyarifa-teiman" },
      update: {},
      create: {
        id: "route-oyarifa-teiman",
        originId: "loc-oyarifa",
        destinationId: "loc-teiman",
        transitType: "Trotro",
        estimatedFare: 2.0,
        whatToLookFor: "Short trotros heading left toward Teiman Market — shout 'Teiman!'",
        durationMins: 10,
      },
    }),
    // Teiman → Madina
    prisma.route.upsert({
      where: { id: "route-teiman-madina" },
      update: {},
      create: {
        id: "route-teiman-madina",
        originId: "loc-teiman",
        destinationId: "loc-madina",
        transitType: "Trotro",
        estimatedFare: 3.0,
        whatToLookFor: "Mates shouting 'Madina! Madina!' — board on the left side of the junction",
        durationMins: 15,
      },
    }),
    // Oyarifa → Madina (direct)
    prisma.route.upsert({
      where: { id: "route-oyarifa-madina" },
      update: {},
      create: {
        id: "route-oyarifa-madina",
        originId: "loc-oyarifa",
        destinationId: "loc-madina",
        transitType: "Trotro",
        estimatedFare: 4.0,
        whatToLookFor: "Listen for mates calling 'Madina direct!' — these skip Teiman",
        durationMins: 20,
      },
    }),
    // Madina → Accra Central
    prisma.route.upsert({
      where: { id: "route-madina-circle" },
      update: {},
      create: {
        id: "route-madina-circle",
        originId: "loc-madina",
        destinationId: "loc-accra-central",
        transitType: "Trotro",
        estimatedFare: 4.5,
        whatToLookFor: "Board from the main Madina station — look for trotros marked 'Circle' or 'Accra'",
        durationMins: 35,
      },
    }),
    // Aburi → Madina (full run)
    prisma.route.upsert({
      where: { id: "route-aburi-madina" },
      update: {},
      create: {
        id: "route-aburi-madina",
        originId: "loc-aburi",
        destinationId: "loc-madina",
        transitType: "Trotro",
        estimatedFare: 8.0,
        whatToLookFor: "Take the Accra-bound trotro from Aburi Junction, alight at Madina Station",
        durationMins: 55,
      },
    }),
  ]);

  console.log(`✅ Seeded ${routes.length} routes`);
  console.log("🎉 Seed complete! Run `npm run db:studio` to browse your data.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

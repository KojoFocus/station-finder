// prisma/seed.ts — Run: npm run db:seed
// All upserts — safe to re-run. Covers 22 locations + 50 routes across major Accra corridors.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Location data ─────────────────────────────────────────────────────────────

const LOCATIONS = [
  // Original pilot corridor
  { id: "loc-aburi",         name: "Aburi Junction",             latitude: 5.8489, longitude: -0.1761, description: "Main junction in Aburi town. Stand opposite the Aburi Gardens entrance — trotros to Accra load here in the morning." },
  { id: "loc-oyarifa",       name: "Oyarifa Junction",           latitude: 5.7005, longitude: -0.1333, description: "Stand at the main roundabout by the Total filling station. Trotros to Madina stop on the right side heading south." },
  { id: "loc-teiman",        name: "Teiman Junction",            latitude: 5.6863, longitude: -0.1488, description: "Stand at the T-junction near the Teiman market. Look for trotros heading toward Madina on the left side." },
  { id: "loc-madina",        name: "Madina Station",             latitude: 5.6833, longitude: -0.1667, description: "Main Madina lorry station. Large terminus — connect to Accra Central, Legon, and other destinations from here." },
  { id: "loc-accra-central", name: "Accra Central (Circle)",     latitude: 5.5560, longitude: -0.2070, description: "Kwame Nkrumah Circle interchange. Major hub for all directions — trotros to every part of Accra load here." },

  // Inner city + west
  { id: "loc-kaneshie",      name: "Kaneshie Station",           latitude: 5.5490, longitude: -0.2300, description: "Main Kaneshie lorry park. Take the bridge entrance — trotros to Circle load on the right side, Dansoman and Lapaz on the left." },
  { id: "loc-37",            name: "37 Junction",                latitude: 5.5864, longitude: -0.1849, description: "Opposite 37 Military Hospital at the overhead flyover. Trotros to Circle load southbound; trotros to Madina and Legon load northbound." },
  { id: "loc-korle-bu",      name: "Korle-Bu",                   latitude: 5.5375, longitude: -0.2346, description: "Opposite Korle-Bu Teaching Hospital main gate. Trotros to Circle load at the hospital junction — very short ride, very frequent." },
  { id: "loc-dansoman",      name: "Dansoman (Eschol Park)",     latitude: 5.5597, longitude: -0.2617, description: "Dansoman Eschol Park junction. Trotros to Circle and Kaneshie load at the main roundabout — listen for 'Circle!' or 'Kaneshie!' shouts." },
  { id: "loc-osu",           name: "Osu (Danquah Circle)",       latitude: 5.5537, longitude: -0.1806, description: "Osu Danquah Circle junction. Trotros to Accra Central and Airport load here — flag one on the Oxford Street junction." },

  // North
  { id: "loc-lapaz",         name: "Lapaz Terminal",             latitude: 5.6226, longitude: -0.2394, description: "Lapaz overhead terminal. Main loading point is under the flyover — look for mates calling 'Circle!' and 'Kaneshie!'" },
  { id: "loc-achimota",      name: "Achimota Station",           latitude: 5.6292, longitude: -0.2199, description: "Achimota station near the overhead bridge. Trotros to Circle, Kaneshie, Dome, and Pokuase all load here — check the mate's shout." },
  { id: "loc-dome",          name: "Dome Station",               latitude: 5.6551, longitude: -0.2387, description: "Dome market junction. Trotros to Achimota and Circle load at the market entrance — look for the yellow-and-blue station sign." },
  { id: "loc-pokuase",       name: "Pokuase Interchange",        latitude: 5.7213, longitude: -0.2636, description: "Pokuase main junction near the new interchange. Trotros to Achimota and Circle load here — very busy in the mornings." },
  { id: "loc-haatso",        name: "Haatso Junction",            latitude: 5.6804, longitude: -0.2062, description: "Haatso junction on the Accra-Kumasi road. Trotros to Madina load eastbound; trotros to Achimota and Circle load southbound." },

  // East
  { id: "loc-legon",         name: "Legon (University of Ghana)", latitude: 5.6502, longitude: -0.1875, description: "University of Ghana main gate junction. Trotros to Circle and Madina load at the gate — flag one down on the main road." },
  { id: "loc-adenta",        name: "Adenta Station",             latitude: 5.7038, longitude: -0.1593, description: "Adenta Barrier station. Stand at the main road — trotros to Madina and Circle load here frequently throughout the day." },
  { id: "loc-spintex",       name: "Spintex Road Junction",      latitude: 5.6238, longitude: -0.1359, description: "Spintex Road junction near the Total station. Trotros to Madina load northbound; trotros to Circle and Airport load southbound." },
  { id: "loc-airport",       name: "Airport (Kotoka)",           latitude: 5.6052, longitude: -0.1711, description: "Near Kotoka International Airport junction on the ring road. Trotros to 37, Legon, and Circle pass here — stand at the ring road bus stop." },

  // Far east / coast
  { id: "loc-teshie",        name: "Teshie Junction",            latitude: 5.5897, longitude: -0.1116, description: "Teshie main junction. Trotros to Circle load at the junction — flag one heading west. Very frequent during rush hours." },
  { id: "loc-nungua",        name: "Nungua Barrier",             latitude: 5.5871, longitude: -0.0711, description: "Nungua barrier junction on the beach road. Trotros to Teshie load westbound; trotros to Circle load along the motorway access road." },
  { id: "loc-tema",          name: "Tema Station (Comm. 1)",     latitude: 5.6680, longitude:  0.0163,  description: "Tema Community 1 main lorry park. Major terminal — trotros to Circle and Accra Central load from the station entrance." },

  // West
  { id: "loc-kasoa",         name: "Kasoa Station",              latitude: 5.5320, longitude: -0.4219, description: "Kasoa main station near the market. Trotros to Accra Circle load from the large lorry park — look for mates shouting 'Circle! Accra!'" },
];

// ── Route data ────────────────────────────────────────────────────────────────

const ROUTES = [
  // ── Original pilot corridor ────────────────────────────────────────────────
  { id: "route-aburi-oyarifa",    originId: "loc-aburi",         destinationId: "loc-oyarifa",       transitType: "Trotro", estimatedFare: 5.0,  durationMins: 40, whatToLookFor: "Mates shouting 'Accra! Accra!' or 'Oyarifa!' from the Aburi junction" },
  { id: "route-oyarifa-teiman",   originId: "loc-oyarifa",       destinationId: "loc-teiman",        transitType: "Trotro", estimatedFare: 2.0,  durationMins: 10, whatToLookFor: "Short trotros heading left toward Teiman Market — shout 'Teiman!'" },
  { id: "route-teiman-madina",    originId: "loc-teiman",        destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 3.0,  durationMins: 15, whatToLookFor: "Mates shouting 'Madina! Madina!' — board on the left side of the junction" },
  { id: "route-oyarifa-madina",   originId: "loc-oyarifa",       destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 4.0,  durationMins: 20, whatToLookFor: "Listen for mates calling 'Madina direct!' — these skip Teiman" },
  { id: "route-madina-circle",    originId: "loc-madina",        destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 4.5,  durationMins: 35, whatToLookFor: "Board from the main Madina station — look for trotros marked 'Circle' or 'Accra'" },
  { id: "route-aburi-madina",     originId: "loc-aburi",         destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 8.0,  durationMins: 55, whatToLookFor: "Take the Accra-bound trotro from Aburi Junction, alight at Madina Station" },

  // ── Circle ↔ Kaneshie ────────────────────────────────────────────────────────
  { id: "route-kaneshie-circle",  originId: "loc-kaneshie",      destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 3.0,  durationMins: 12, whatToLookFor: "Trotros heading right from the lorry park entrance — mates shout 'Circle! Circle!'" },
  { id: "route-circle-kaneshie",  originId: "loc-accra-central", destinationId: "loc-kaneshie",      transitType: "Trotro", estimatedFare: 3.0,  durationMins: 12, whatToLookFor: "From Circle overpass, board trotros on the west side — listen for 'Kaneshie! Kaneshie!'" },

  // ── Circle ↔ Madina ──────────────────────────────────────────────────────────
  { id: "route-circle-madina",    originId: "loc-accra-central", destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 4.5,  durationMins: 35, whatToLookFor: "From Circle, board on the northeast side of the roundabout — look for 'Madina!' shouts" },

  // ── Lapaz corridor ──────────────────────────────────────────────────────────
  { id: "route-lapaz-kaneshie",   originId: "loc-lapaz",         destinationId: "loc-kaneshie",      transitType: "Trotro", estimatedFare: 3.5,  durationMins: 20, whatToLookFor: "From under the Lapaz flyover, board trotros heading south — mates shout 'Kaneshie!'" },
  { id: "route-lapaz-circle",     originId: "loc-lapaz",         destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 5.0,  durationMins: 30, whatToLookFor: "Direct trotros to Circle load under the flyover — look for 'Circle direct!'" },
  { id: "route-kaneshie-lapaz",   originId: "loc-kaneshie",      destinationId: "loc-lapaz",         transitType: "Trotro", estimatedFare: 3.5,  durationMins: 20, whatToLookFor: "From Kaneshie lorry park left side — mates shout 'Lapaz! Awoshie!'" },

  // ── Achimota corridor ────────────────────────────────────────────────────────
  { id: "route-achimota-circle",  originId: "loc-achimota",      destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 4.5,  durationMins: 25, whatToLookFor: "From Achimota overhead bridge, board southbound trotros — 'Circle! Kaneshie!' calls" },
  { id: "route-circle-achimota",  originId: "loc-accra-central", destinationId: "loc-achimota",      transitType: "Trotro", estimatedFare: 4.5,  durationMins: 25, whatToLookFor: "From Circle, board on the north side — listen for 'Achimota! Dome! Pokuase!'" },
  { id: "route-achimota-kaneshie",originId: "loc-achimota",      destinationId: "loc-kaneshie",      transitType: "Trotro", estimatedFare: 3.5,  durationMins: 20, whatToLookFor: "From Achimota station, board trotros heading west — 'Kaneshie!' shout from the mate" },

  // ── Dome ────────────────────────────────────────────────────────────────────
  { id: "route-dome-achimota",    originId: "loc-dome",          destinationId: "loc-achimota",      transitType: "Trotro", estimatedFare: 2.5,  durationMins: 15, whatToLookFor: "From Dome market junction, board trotros heading south — mates shout 'Achimota!'" },
  { id: "route-dome-circle",      originId: "loc-dome",          destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 5.0,  durationMins: 30, whatToLookFor: "Direct trotros to Circle from Dome market — 'Circle direct!' from the mate" },
  { id: "route-circle-dome",      originId: "loc-accra-central", destinationId: "loc-dome",          transitType: "Trotro", estimatedFare: 5.0,  durationMins: 30, whatToLookFor: "From Circle, north side near the Shell station — listen for 'Dome! Dome!'" },

  // ── Pokuase ──────────────────────────────────────────────────────────────────
  { id: "route-pokuase-achimota", originId: "loc-pokuase",       destinationId: "loc-achimota",      transitType: "Trotro", estimatedFare: 5.0,  durationMins: 40, whatToLookFor: "From Pokuase interchange, board trotros heading south — 'Achimota! Accra!' from the mate" },
  { id: "route-pokuase-circle",   originId: "loc-pokuase",       destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 8.0,  durationMins: 60, whatToLookFor: "Direct 'Circle' trotros from Pokuase — very busy in mornings, board early" },

  // ── Haatso ────────────────────────────────────────────────────────────────
  { id: "route-haatso-madina",    originId: "loc-haatso",        destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 3.0,  durationMins: 20, whatToLookFor: "From Haatso junction, board eastbound trotros — 'Madina! Madina!' from the mate" },
  { id: "route-haatso-achimota",  originId: "loc-haatso",        destinationId: "loc-achimota",      transitType: "Trotro", estimatedFare: 4.0,  durationMins: 25, whatToLookFor: "From Haatso junction, board southbound trotros on the Accra-Kumasi road — 'Achimota!'" },

  // ── Legon corridor ───────────────────────────────────────────────────────────
  { id: "route-legon-madina",     originId: "loc-legon",         destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 3.0,  durationMins: 20, whatToLookFor: "From Legon gate junction, flag down trotros heading east — listen for 'Madina!'" },
  { id: "route-madina-legon",     originId: "loc-madina",        destinationId: "loc-legon",         transitType: "Trotro", estimatedFare: 3.0,  durationMins: 20, whatToLookFor: "From Madina station east side, board trotros to Legon — 'Legon! University!'" },
  { id: "route-legon-circle",     originId: "loc-legon",         destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 5.0,  durationMins: 35, whatToLookFor: "From Legon gate, board trotros heading southwest — mates shout 'Circle! Accra!'" },
  { id: "route-circle-legon",     originId: "loc-accra-central", destinationId: "loc-legon",         transitType: "Trotro", estimatedFare: 5.0,  durationMins: 35, whatToLookFor: "From Circle, board northeast — 'Legon! 37!' from the mate on the ring road side" },
  { id: "route-legon-37",         originId: "loc-legon",         destinationId: "loc-37",            transitType: "Trotro", estimatedFare: 3.5,  durationMins: 20, whatToLookFor: "From Legon gate, board trotros heading south on the Legon road — '37! Hospital!'" },

  // ── 37 corridor ─────────────────────────────────────────────────────────────
  { id: "route-37-circle",        originId: "loc-37",            destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 2.5,  durationMins: 15, whatToLookFor: "From 37 flyover, board trotros heading south — 'Circle! Accra!' from the mate" },
  { id: "route-circle-37",        originId: "loc-accra-central", destinationId: "loc-37",            transitType: "Trotro", estimatedFare: 2.5,  durationMins: 15, whatToLookFor: "From Circle, board on the ring road side heading northeast — '37! Legon!' shouts" },
  { id: "route-37-madina",        originId: "loc-37",            destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 4.0,  durationMins: 25, whatToLookFor: "From 37, board trotros heading east on the ring road — 'Madina! Madina!'" },

  // ── Adenta corridor ──────────────────────────────────────────────────────────
  { id: "route-adenta-madina",    originId: "loc-adenta",        destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 3.5,  durationMins: 20, whatToLookFor: "From Adenta Barrier, board southbound trotros — mates shout 'Madina! Madina!'" },
  { id: "route-madina-adenta",    originId: "loc-madina",        destinationId: "loc-adenta",        transitType: "Trotro", estimatedFare: 3.5,  durationMins: 20, whatToLookFor: "From Madina station north exit, board trotros heading to Adenta — 'Adenta! Barrier!'" },
  { id: "route-adenta-legon",     originId: "loc-adenta",        destinationId: "loc-legon",         transitType: "Trotro", estimatedFare: 3.5,  durationMins: 25, whatToLookFor: "From Adenta Barrier, board trotros heading southwest — 'Legon! University!'" },

  // ── Spintex ───────────────────────────────────────────────────────────────
  { id: "route-spintex-madina",   originId: "loc-spintex",       destinationId: "loc-madina",        transitType: "Trotro", estimatedFare: 4.5,  durationMins: 30, whatToLookFor: "From Spintex Total junction, board northbound trotros — 'Madina! Madina!'" },
  { id: "route-spintex-circle",   originId: "loc-spintex",       destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 5.5,  durationMins: 40, whatToLookFor: "From Spintex junction, board trotros heading southwest — 'Circle! Accra!'" },

  // ── Kasoa ─────────────────────────────────────────────────────────────────
  { id: "route-kasoa-circle",     originId: "loc-kasoa",         destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 12.0, durationMins: 60, whatToLookFor: "From Kasoa lorry park, board trotros to Circle — 'Circle! Accra!' Very frequent, very full." },
  { id: "route-kasoa-kaneshie",   originId: "loc-kasoa",         destinationId: "loc-kaneshie",      transitType: "Trotro", estimatedFare: 10.0, durationMins: 50, whatToLookFor: "From Kasoa lorry park, some trotros terminate at Kaneshie — ask 'Kaneshie?' before boarding" },
  { id: "route-circle-kasoa",     originId: "loc-accra-central", destinationId: "loc-kasoa",         transitType: "Trotro", estimatedFare: 12.0, durationMins: 60, whatToLookFor: "From Circle west side near Kaneshie road — board trotros calling 'Kasoa! Kasoa!'" },

  // ── Korle-Bu ──────────────────────────────────────────────────────────────
  { id: "route-korle-bu-circle",  originId: "loc-korle-bu",      destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 2.0,  durationMins: 10, whatToLookFor: "Opposite the hospital main gate — very short ride, trotros pass constantly. 'Circle!'" },
  { id: "route-circle-korle-bu",  originId: "loc-accra-central", destinationId: "loc-korle-bu",      transitType: "Trotro", estimatedFare: 2.0,  durationMins: 10, whatToLookFor: "From Circle, board on the west side — 'Korle-Bu! Hospital!'" },

  // ── Dansoman ──────────────────────────────────────────────────────────────
  { id: "route-dansoman-circle",  originId: "loc-dansoman",      destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 4.5,  durationMins: 25, whatToLookFor: "From Eschol Park roundabout, board eastbound trotros — 'Circle! Accra!'" },
  { id: "route-dansoman-kaneshie",originId: "loc-dansoman",      destinationId: "loc-kaneshie",      transitType: "Trotro", estimatedFare: 3.0,  durationMins: 15, whatToLookFor: "From Eschol Park, board trotros northeast — 'Kaneshie!' from the mate" },
  { id: "route-circle-dansoman",  originId: "loc-accra-central", destinationId: "loc-dansoman",      transitType: "Trotro", estimatedFare: 4.5,  durationMins: 25, whatToLookFor: "From Circle west side, board trotros heading toward Kaneshie road — 'Dansoman! Eschol!'" },

  // ── Coastal (Teshie / Nungua) ─────────────────────────────────────────────
  { id: "route-nungua-teshie",    originId: "loc-nungua",        destinationId: "loc-teshie",        transitType: "Trotro", estimatedFare: 2.5,  durationMins: 15, whatToLookFor: "From Nungua barrier, board westbound trotros — 'Teshie! Teshie!'" },
  { id: "route-teshie-circle",    originId: "loc-teshie",        destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 5.0,  durationMins: 35, whatToLookFor: "From Teshie junction, board westbound trotros — 'Circle! Accra!' Very busy at rush hour." },
  { id: "route-nungua-circle",    originId: "loc-nungua",        destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 6.0,  durationMins: 45, whatToLookFor: "From Nungua barrier, board direct trotros to Circle — 'Circle direct!' on the beach road" },
  { id: "route-circle-teshie",    originId: "loc-accra-central", destinationId: "loc-teshie",        transitType: "Trotro", estimatedFare: 5.0,  durationMins: 35, whatToLookFor: "From Circle east side on the Teshie road — 'Teshie! Nungua!' from the mate" },

  // ── Tema ─────────────────────────────────────────────────────────────────
  { id: "route-tema-circle",      originId: "loc-tema",          destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 10.0, durationMins: 60, whatToLookFor: "From Tema Comm. 1 station, board trotros to Accra — 'Circle! Accra!' Very full in mornings." },
  { id: "route-circle-tema",      originId: "loc-accra-central", destinationId: "loc-tema",          transitType: "Trotro", estimatedFare: 10.0, durationMins: 60, whatToLookFor: "From Circle, board on the Tema road side — 'Tema! Tema!' Sit tight, it's a long journey." },

  // ── Airport / Osu ─────────────────────────────────────────────────────────
  { id: "route-osu-circle",       originId: "loc-osu",           destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 2.5,  durationMins: 15, whatToLookFor: "From Danquah Circle Osu, board trotros on Oxford Street junction — 'Circle! Accra!'" },
  { id: "route-airport-37",       originId: "loc-airport",       destinationId: "loc-37",            transitType: "Trotro", estimatedFare: 2.5,  durationMins: 15, whatToLookFor: "Near Kotoka Airport junction on the ring road — board trotros heading north. '37! Hospital!'" },
  { id: "route-airport-circle",   originId: "loc-airport",       destinationId: "loc-accra-central", transitType: "Trotro", estimatedFare: 3.0,  durationMins: 20, whatToLookFor: "From the Airport ring road bus stop, board trotros heading south — 'Circle! Accra!'" },
  { id: "route-airport-legon",    originId: "loc-airport",       destinationId: "loc-legon",         transitType: "Trotro", estimatedFare: 3.0,  durationMins: 20, whatToLookFor: "From Airport junction, board trotros northeast toward Legon — 'Legon! University!'" },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding Station Finder — Accra corridors…");

  // Locations: run in small parallel batches (fewer connections needed)
  for (let i = 0; i < LOCATIONS.length; i += 5) {
    await Promise.all(
      LOCATIONS.slice(i, i + 5).map((loc) =>
        prisma.location.upsert({ where: { id: loc.id }, update: {}, create: loc })
      )
    );
  }
  console.log(`✅ ${LOCATIONS.length} locations seeded`);

  // Routes: sequential to respect connection_limit=1
  let done = 0;
  for (const route of ROUTES) {
    await prisma.route.upsert({ where: { id: route.id }, update: {}, create: route });
    done++;
    if (done % 10 === 0) console.log(`   ${done}/${ROUTES.length} routes…`);
  }
  console.log(`✅ ${ROUTES.length} routes seeded`);
  console.log("🎉 Done! Accra's trotro network is mapped.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

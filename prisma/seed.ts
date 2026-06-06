// prisma/seed.ts — Run: npm run db:seed
// All upserts — safe to re-run.
// 56 locations · 163 routes · covers inner-city Accra + intercity Ghana

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Locations ─────────────────────────────────────────────────────────────────

const LOCATIONS = [

  // ── Original Pilot Corridor & Ga East Expansions ─────────────────────────────
  { id: "loc-aburi",         name: "Aburi Junction",              latitude:  5.8502, longitude: -0.1834, description: "N4 ridge entry point. Passenger split for Accra and interior — trotros to Accra load opposite the Aburi Gardens entrance." },
  { id: "loc-abokobi",       name: "Abokobi Town Station",        latitude:  5.7341, longitude: -0.2062, description: "Main lorry park facing the old Presby church. Trotros to Madina and Circle load here — very busy in early mornings." },
  { id: "loc-pantang",       name: "Pantang Junction",            latitude:  5.7215, longitude: -0.1845, description: "Active N4 roadside stop for interior route switch. Trotros to Madina and Oyarifa board on the highway lip." },
  { id: "loc-teiman",        name: "Teiman Junction",             latitude:  5.7480, longitude: -0.1910, description: "Main roadside branch-line stop. Trotros heading south to Madina and west to Abokobi load at the T-junction." },
  { id: "loc-oyarifa",       name: "Oyarifa Junction",            latitude:  5.7685, longitude: -0.1792, description: "Crucial N4 highway roadside loading point. Stand at the roundabout — trotros to Madina stop on the right side heading south." },

  // ── Major Accra Hubs ─────────────────────────────────────────────────────────
  { id: "loc-accra-central", name: "Accra Central (Circle)",      latitude:  5.5698, longitude: -0.2184, description: "Kwame Nkrumah Circle interchange — all main lines converge here. The biggest hub in Accra." },
  { id: "loc-madina",        name: "Madina Station",              latitude:  5.6812, longitude: -0.1678, description: "Main Madina Zongo Junction overhead terminal. Large terminus — connect to Circle, Legon, Adenta, and Abokobi from here." },
  { id: "loc-kaneshie",      name: "Kaneshie Station",            latitude:  5.5532, longitude: -0.2325, description: "Market complex main loading yard. Trotros to Circle load on the right; Dansoman and Lapaz on the left." },
  { id: "loc-tema",          name: "Tema Station (Comm. 1)",      latitude:  5.6420, longitude:  0.0035, description: "Central shipping and industrial terminal. Trotros to Circle and Accra Central load from the station entrance." },

  // ── Inner-City North & Peripherals ───────────────────────────────────────────
  { id: "loc-ashongman",     name: "Ashongman Estate Last Stop",  latitude:  5.7132, longitude: -0.2248, description: "True turnaround loop at the end of the asphalt. Trotros back to Dome and Achimota load at the loop — 'Dome! Achimota!'" },
  { id: "loc-kwabenya",      name: "Kwabenya Abuom Junction",     latitude:  5.6882, longitude: -0.2315, description: "Crossroads connecting Dome, Atomic, and Brekusu. Trotros to Dome, Achimota, and Madina junction load here." },
  { id: "loc-lapaz",         name: "Lapaz Terminal",              latitude:  5.6215, longitude: -0.2355, description: "George W. Bush N1 footbridge hub. Board under the flyover — mates call 'Circle!' and 'Kaneshie!'" },
  { id: "loc-achimota",      name: "Achimota New Terminal",       latitude:  5.6292, longitude: -0.2199, description: "Gated multi-acre motorway terminal. Trotros to Circle, Kaneshie, Dome, and Pokuase all load here." },
  { id: "loc-dome",          name: "Dome Station",                latitude:  5.6551, longitude: -0.2387, description: "Railway crossing market-line stop. Trotros to Achimota and Circle load at the market entrance." },
  { id: "loc-pokuase",       name: "Pokuase Interchange",         latitude:  5.7213, longitude: -0.2636, description: "Tier-4 junction linking the Amasaman line. Very busy in the mornings — board trotros calling 'Achimota! Circle!'" },
  { id: "loc-haatso",        name: "Haatso Junction",             latitude:  5.6804, longitude: -0.2062, description: "Main roadside loading point on the Accra-Kumasi road. Trotros to Madina eastbound; Achimota and Circle southbound." },
  { id: "loc-ofankor",       name: "Ofankor Barrier",             latitude:  5.6800, longitude: -0.2550, description: "N6 transit gateway checkpoint between Achimota and Pokuase. Board trotros calling 'Achimota!' or 'Pokuase!'" },
  { id: "loc-awoshie",       name: "Awoshie Mangoase",            latitude:  5.6171, longitude: -0.2625, description: "True intersection loading zone on the main road. Trotros to Lapaz, Dansoman, and Circle load at the market junction." },
  { id: "loc-amasaman",      name: "Amasaman Station",            latitude:  5.7124, longitude: -0.2856, description: "Municipal rail-side lorry park north of Achimota. Trotros to Achimota, Pokuase, and Nsawam load here." },
  { id: "loc-tesano",        name: "Tesano (Abeka Junction)",     latitude:  5.6086, longitude: -0.2241, description: "N6 gateway junction stop near Achimota road. Trotros to Lapaz, Achimota, and Circle pass through here." },

  // ── Inner-City West & Central Links ──────────────────────────────────────────
  { id: "loc-37",            name: "37 Military Junction",        latitude:  5.5864, longitude: -0.1849, description: "Station outside 37 Military Hospital on Liberation Road. Trotros to Circle southbound; Madina and Legon northbound." },
  { id: "loc-korle-bu",      name: "Korle-Bu Loading Bay",        latitude:  5.5375, longitude: -0.2346, description: "Hospital gate transit turnaround. Very short ride to Circle — trotros pass constantly. 'Circle!'" },
  { id: "loc-dansoman",      name: "Dansoman (Eschol Park)",      latitude:  5.5597, longitude: -0.2617, description: "Control market mainline terminal. Trotros to Circle and Kaneshie load at the main roundabout." },
  { id: "loc-darkuman",      name: "Darkuman Junction",           latitude:  5.5910, longitude: -0.2420, description: "Residential route feeder station between Achimota and Kaneshie. Listen for the mate's call." },
  { id: "loc-odorkor",       name: "Odorkor Official Station",    latitude:  5.5820, longitude: -0.2549, description: "Winneba Road transit core west of Circle. Trotros to Kaneshie and Circle are frequent throughout the day." },
  { id: "loc-mallam",        name: "Mallam Junction",             latitude:  5.5630, longitude: -0.2775, description: "Interchange area for Kasoa-bound cars. Trotros to Circle and Kasoa load at this busy junction." },
  { id: "loc-kasoa",         name: "Kasoa Main Station",          latitude:  5.5320, longitude: -0.4219, description: "Massive boundary flyover terminal. Trotros to Accra Circle load from the large lorry park — 'Circle! Accra!'" },
  { id: "loc-weija",         name: "Weija Junction",              latitude:  5.5591, longitude: -0.3287, description: "Mall-side link to barrier cars. Trotros to Kasoa, Kaneshie, and Circle load at this major crossroads." },

  // ── Inner-City East ──────────────────────────────────────────────────────────
  { id: "loc-legon",         name: "Legon Main Gate",             latitude:  5.6502, longitude: -0.1875, description: "University highway underpass stop. Trotros to Circle and Madina load at the gate on the main road." },
  { id: "loc-atomic",        name: "Atomic Junction",             latitude:  5.6582, longitude: -0.1714, description: "Flyover base switch for Madina and Haatso. Very busy hub — connects Legon, East Legon, Madina, and Circle." },
  { id: "loc-east-legon",    name: "East Legon (Bawaleshie)",     latitude:  5.6363, longitude: -0.1578, description: "Local terminal near dynamic market area. Trotros to Legon, Atomic, and Circle load at the main road junction." },
  { id: "loc-adenta",        name: "Adenta Barrier Station",      latitude:  5.7021, longitude: -0.1620, description: "Major northern terminal yard. Stand at the main road — trotros to Madina and Circle load here frequently." },
  { id: "loc-spintex",       name: "Spintex Coca-Cola Junction",  latitude:  5.6238, longitude: -0.1359, description: "Industrial/commercial line backbone junction. Trotros to Madina northbound; Circle and Airport southbound." },

  // ── Coastal & Heavy Transit Zones ────────────────────────────────────────────
  { id: "loc-teshie",        name: "Teshie Lascala Junction",     latitude:  5.5897, longitude: -0.1116, description: "Coastal road commuter artery. Trotros to Circle load at the junction — flag one heading west." },
  { id: "loc-nungua",        name: "Nungua Barrier",              latitude:  5.5871, longitude: -0.0711, description: "Major beach road interchange artery. Trotros to Teshie westbound; Circle via motorway." },
  { id: "loc-ashaiman",      name: "Ashaiman Lorry Station",      latitude:  5.6957, longitude:  0.0315, description: "Ashaiman main lorry station east of Tema. Trotros to Tema and Circle load here — large busy terminal." },

  // ── Other Key Accra Terminals ────────────────────────────────────────────────
  { id: "loc-airport",       name: "Airport (Kotoka)",            latitude:  5.6052, longitude: -0.1711, description: "Aviation road intersection stop on the ring road. Trotros to 37, Legon, and Circle pass here." },
  { id: "loc-osu",           name: "Osu (Danquah Circle)",        latitude:  5.5537, longitude: -0.1806, description: "Oxford Street / Ring Road nexus. Trotros to Accra Central and Airport load here." },
  { id: "loc-abossey-okai",  name: "Abossey Okai Market",         latitude:  5.5600, longitude: -0.2150, description: "Spare parts commercial transit hub. Trotros to Circle and Kaneshie load at the junction." },
  { id: "loc-stc-terminal",  name: "Accra STC Terminal",          latitude:  5.5637, longitude: -0.2018, description: "Intercity yard in Industrial Area near Circle. Buy tickets at the counter — book online at stcgh.com." },

  // ── Central Business District & Inner Additions ───────────────────────────────
  { id: "loc-nima",          name: "Nima Junction",               latitude:  5.5731, longitude: -0.2019, description: "Highway road corridor artery stop. Very busy — trotros to Circle southbound and Achimota northbound load here." },
  { id: "loc-tudu",          name: "Tudu Terminal",               latitude:  5.5494, longitude: -0.2063, description: "Central business district core station near Makola. Short walk to Circle — trotros and taxis everywhere." },
  { id: "loc-agbogbloshie",  name: "Agbogbloshie Market",         latitude:  5.5478, longitude: -0.2288, description: "Dense market route node between Circle and Kaneshie. Board trotros east to Circle or west to Kaneshie." },
  { id: "loc-bubuashie",     name: "Bubuashie",                   latitude:  5.5697, longitude: -0.2489, description: "Local urban link line stop northwest of Circle. Trotros to Kaneshie, Darkuman, and Circle load at the market junction." },
  { id: "loc-kanda",         name: "Kanda Highway",               latitude:  5.5978, longitude: -0.1926, description: "Central express route avenue stop on the ring road. Trotros to 37 and Circle load on the highway shoulder." },

  // ── Intercity destinations ───────────────────────────────────────────────────
  { id: "loc-kumasi",        name: "Kumasi (Kejetia)",            latitude:  6.6885, longitude: -1.6244, description: "Massive regional transport terminal. Kejetia is the main intercity bus/trotro station in Kumasi." },
  { id: "loc-cape-coast",    name: "Cape Coast Lorry Park",       latitude:  5.1053, longitude: -1.2466, description: "Central regional tourist and transit yard. Hub for the Central Region — UNESCO Heritage sites nearby." },
  { id: "loc-takoradi",      name: "Takoradi Circle",             latitude:  4.8845, longitude: -1.7554, description: "Western regional core terminal. Major oil city and port." },
  { id: "loc-koforidua",     name: "Koforidua Main Station",      latitude:  6.0940, longitude: -0.2550, description: "Eastern regional capital hub. Relatively short journey from Accra (~2 hours)." },
  { id: "loc-ho",            name: "Ho Main Station",             latitude:  6.6000, longitude:  0.4720, description: "Volta regional hub terminal. Beautiful scenery on the way." },
  { id: "loc-tamale",        name: "Tamale Central Lorry Park",   latitude:  9.4008, longitude: -0.8393, description: "Northern regional transit gateway. Long journey — book in advance and pack food." },
  { id: "loc-nsawam",        name: "Nsawam Station",              latitude:  5.8044, longitude: -0.3629, description: "Periphery link terminal yard. Short intercity journey from Accra (~1 hour). Frequent trotros." },
  { id: "loc-winneba",       name: "Winneba Junction",            latitude:  5.3528, longitude: -0.6209, description: "Coastal highway transit split. About 1.5 hours from Accra on the coastal highway." },
  { id: "loc-sunyani",       name: "Sunyani Lorry Park",          latitude:  7.3349, longitude: -2.3275, description: "Bono regional core station. About 6 hours from Accra via Kumasi. Book VIP or STC." },
  { id: "loc-bolgatanga",    name: "Bolgatanga Station",          latitude: 10.7869, longitude: -0.8514, description: "Upper East regional link gateway. Long overnight journey — book STC or VIP in advance." },
  { id: "loc-wa",            name: "Wa Central Lorry Park",       latitude: 10.0601, longitude: -2.5099, description: "Upper West regional link gateway. Very long journey (~12 hrs) — book overnight bus from STC terminal." },
];

// ── Routes ────────────────────────────────────────────────────────────────────

const ROUTES = [

  // ── Original pilot corridor (updated with Abokobi / Pantang) ─────────────────
  { id: "route-aburi-oyarifa",      originId: "loc-aburi",         destinationId: "loc-oyarifa",       transitType: "Trotro",        estimatedFare:  5.0, durationMins:  40, whatToLookFor: "Mates shouting 'Accra! Accra!' or 'Oyarifa!' from the Aburi junction" },
  { id: "route-oyarifa-teiman",     originId: "loc-oyarifa",       destinationId: "loc-teiman",        transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "Short trotros heading south toward Teiman — shout 'Teiman!'" },
  { id: "route-teiman-pantang",     originId: "loc-teiman",        destinationId: "loc-pantang",       transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Teiman T-junction, southwestbound — 'Pantang!'" },
  { id: "route-pantang-madina",     originId: "loc-pantang",       destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Pantang junction, southbound on the N4 — 'Madina! Madina!'" },
  { id: "route-pantang-teiman",     originId: "loc-pantang",       destinationId: "loc-teiman",        transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Pantang, northbound — 'Teiman! Oyarifa!'" },
  { id: "route-oyarifa-madina",     originId: "loc-oyarifa",       destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  4.0, durationMins:  20, whatToLookFor: "Listen for 'Madina direct!' — these skip Teiman" },
  { id: "route-teiman-abokobi",     originId: "loc-teiman",        destinationId: "loc-abokobi",       transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Teiman T-junction, westbound — 'Abokobi!'" },
  { id: "route-abokobi-teiman",     originId: "loc-abokobi",       destinationId: "loc-teiman",        transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Abokobi lorry park, eastbound — 'Teiman! Madina!'" },
  { id: "route-abokobi-madina",     originId: "loc-abokobi",       destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Abokobi lorry park, southeastbound direct — 'Madina!'" },
  { id: "route-madina-abokobi",     originId: "loc-madina",        destinationId: "loc-abokobi",       transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Madina station north side — 'Abokobi! Ga East!'" },
  { id: "route-teiman-madina",      originId: "loc-teiman",        destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  3.0, durationMins:  15, whatToLookFor: "Mates shouting 'Madina! Madina!' — board on the left side of the junction" },
  { id: "route-madina-circle",      originId: "loc-madina",        destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  4.5, durationMins:  35, whatToLookFor: "From Madina station — look for trotros marked 'Circle' or 'Accra'" },
  { id: "route-circle-madina",      originId: "loc-accra-central", destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  4.5, durationMins:  35, whatToLookFor: "From Circle, board on the northeast side of the roundabout — 'Madina!' shouts" },
  { id: "route-aburi-madina",       originId: "loc-aburi",         destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  8.0, durationMins:  55, whatToLookFor: "Take the Accra-bound trotro from Aburi Junction, alight at Madina Station" },

  // ── Circle ↔ Kaneshie ────────────────────────────────────────────────────────
  { id: "route-kaneshie-circle",    originId: "loc-kaneshie",      destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  3.0, durationMins:  12, whatToLookFor: "Trotros heading right from the lorry park entrance — mates shout 'Circle! Circle!'" },
  { id: "route-circle-kaneshie",    originId: "loc-accra-central", destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  3.0, durationMins:  12, whatToLookFor: "From Circle overpass, west side — listen for 'Kaneshie! Kaneshie!'" },

  // ── Lapaz corridor ───────────────────────────────────────────────────────────
  { id: "route-lapaz-kaneshie",     originId: "loc-lapaz",         destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From under the Lapaz flyover, board trotros heading south — 'Kaneshie!'" },
  { id: "route-lapaz-circle",       originId: "loc-lapaz",         destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  5.0, durationMins:  30, whatToLookFor: "Direct trotros to Circle load under the flyover — look for 'Circle direct!'" },
  { id: "route-kaneshie-lapaz",     originId: "loc-kaneshie",      destinationId: "loc-lapaz",         transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Kaneshie lorry park left side — mates shout 'Lapaz! Awoshie!'" },

  // ── Achimota / Dome / Pokuase ────────────────────────────────────────────────
  { id: "route-achimota-circle",    originId: "loc-achimota",      destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  4.5, durationMins:  25, whatToLookFor: "From Achimota overhead bridge, southbound trotros — 'Circle! Kaneshie!'" },
  { id: "route-circle-achimota",    originId: "loc-accra-central", destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  4.5, durationMins:  25, whatToLookFor: "From Circle north side — listen for 'Achimota! Dome! Pokuase!'" },
  { id: "route-achimota-kaneshie",  originId: "loc-achimota",      destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Achimota station, board trotros heading west — 'Kaneshie!'" },
  { id: "route-dome-achimota",      originId: "loc-dome",          destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Dome market junction, southbound trotros — 'Achimota!'" },
  { id: "route-dome-circle",        originId: "loc-dome",          destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  5.0, durationMins:  30, whatToLookFor: "Direct trotros to Circle from Dome market — 'Circle direct!'" },
  { id: "route-circle-dome",        originId: "loc-accra-central", destinationId: "loc-dome",          transitType: "Trotro",        estimatedFare:  5.0, durationMins:  30, whatToLookFor: "From Circle north side near the Shell station — 'Dome! Dome!'" },
  { id: "route-pokuase-achimota",   originId: "loc-pokuase",       destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  5.0, durationMins:  40, whatToLookFor: "From Pokuase interchange, board trotros heading south — 'Achimota! Accra!'" },
  { id: "route-pokuase-circle",     originId: "loc-pokuase",       destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  8.0, durationMins:  60, whatToLookFor: "Direct 'Circle' trotros from Pokuase — very busy in mornings, board early" },
  { id: "route-ofankor-achimota",   originId: "loc-ofankor",       destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Ofankor barrier, southbound trotros on the Kumasi road — 'Achimota!'" },
  { id: "route-ofankor-pokuase",    originId: "loc-ofankor",       destinationId: "loc-pokuase",       transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Ofankor, northbound trotros — 'Pokuase!'" },
  { id: "route-achimota-ofankor",   originId: "loc-achimota",      destinationId: "loc-ofankor",       transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Achimota station, northbound on the Kumasi road — 'Ofankor! Pokuase!'" },
  { id: "route-haatso-madina",      originId: "loc-haatso",        destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Haatso junction, eastbound trotros — 'Madina!'" },
  { id: "route-haatso-achimota",    originId: "loc-haatso",        destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  4.0, durationMins:  25, whatToLookFor: "From Haatso, southbound on the Accra-Kumasi road — 'Achimota!'" },

  // ── Ashongman ────────────────────────────────────────────────────────────────
  { id: "route-ashongman-dome",     originId: "loc-ashongman",     destinationId: "loc-dome",          transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Ashongman loop, southbound — 'Dome! Market!'" },
  { id: "route-ashongman-achimota", originId: "loc-ashongman",     destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Ashongman last stop, southbound direct — 'Achimota! Accra!'" },
  { id: "route-dome-ashongman",     originId: "loc-dome",          destinationId: "loc-ashongman",     transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Dome market junction, northbound — 'Ashongman! Estate!'" },
  { id: "route-achimota-ashongman", originId: "loc-achimota",      destinationId: "loc-ashongman",     transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Achimota station, northbound — 'Ashongman!' Less frequent — ask the mate." },

  // ── Kwabenya ─────────────────────────────────────────────────────────────────
  { id: "route-kwabenya-dome",      originId: "loc-kwabenya",      destinationId: "loc-dome",          transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Kwabenya Abuom junction, southwestbound — 'Dome!'" },
  { id: "route-kwabenya-achimota",  originId: "loc-kwabenya",      destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  4.0, durationMins:  30, whatToLookFor: "From Kwabenya, southbound — 'Achimota! Accra!'" },
  { id: "route-kwabenya-atomic",    originId: "loc-kwabenya",      destinationId: "loc-atomic",        transitType: "Trotro",        estimatedFare:  3.5, durationMins:  25, whatToLookFor: "From Kwabenya crossroads, eastbound — 'Atomic!'" },
  { id: "route-dome-kwabenya",      originId: "loc-dome",          destinationId: "loc-kwabenya",      transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Dome market, northeastbound — 'Kwabenya! Brekusu!'" },
  { id: "route-madina-kwabenya",    originId: "loc-madina",        destinationId: "loc-kwabenya",      transitType: "Trotro",        estimatedFare:  3.5, durationMins:  25, whatToLookFor: "From Madina station west side — 'Kwabenya!'" },

  // ── Awoshie ──────────────────────────────────────────────────────────────────
  { id: "route-awoshie-lapaz",      originId: "loc-awoshie",       destinationId: "loc-lapaz",         transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Awoshie junction, eastbound trotros — 'Lapaz!'" },
  { id: "route-lapaz-awoshie",      originId: "loc-lapaz",         destinationId: "loc-awoshie",       transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From under the Lapaz flyover, westbound — 'Awoshie!'" },
  { id: "route-awoshie-circle",     originId: "loc-awoshie",       destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Awoshie junction, board trotros heading east — 'Circle! Accra!'" },
  { id: "route-awoshie-dansoman",   originId: "loc-awoshie",       destinationId: "loc-dansoman",      transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Awoshie, southeastbound — 'Dansoman! Eschol!'" },

  // ── 37 corridor ──────────────────────────────────────────────────────────────
  { id: "route-37-circle",          originId: "loc-37",            destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From 37 flyover, southbound trotros — 'Circle! Accra!'" },
  { id: "route-circle-37",          originId: "loc-accra-central", destinationId: "loc-37",            transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Circle ring road side heading northeast — '37! Legon!'" },
  { id: "route-37-madina",          originId: "loc-37",            destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  4.0, durationMins:  25, whatToLookFor: "From 37, eastbound on the ring road — 'Madina!'" },

  // ── Legon / Atomic / East Legon ──────────────────────────────────────────────
  { id: "route-legon-madina",       originId: "loc-legon",         destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Legon gate junction, eastbound trotros — 'Madina!'" },
  { id: "route-madina-legon",       originId: "loc-madina",        destinationId: "loc-legon",         transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Madina station east side — 'Legon! University!'" },
  { id: "route-legon-circle",       originId: "loc-legon",         destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Legon gate, southwestbound trotros — 'Circle! Accra!'" },
  { id: "route-circle-legon",       originId: "loc-accra-central", destinationId: "loc-legon",         transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Circle northeast — 'Legon! 37!' on the ring road side" },
  { id: "route-legon-37",           originId: "loc-legon",         destinationId: "loc-37",            transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Legon gate, southbound on the Legon road — '37! Hospital!'" },
  { id: "route-legon-atomic",       originId: "loc-legon",         destinationId: "loc-atomic",        transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Legon gate, very short eastbound ride — 'Atomic!'" },
  { id: "route-atomic-legon",       originId: "loc-atomic",        destinationId: "loc-legon",         transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Atomic junction, westbound — 'Legon! University!'" },
  { id: "route-atomic-madina",      originId: "loc-atomic",        destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Atomic, northeastbound — 'Madina!'" },
  { id: "route-atomic-circle",      originId: "loc-atomic",        destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Atomic junction, southwestbound trotros — 'Circle! Accra!'" },
  { id: "route-atomic-37",          originId: "loc-atomic",        destinationId: "loc-37",            transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Atomic, southbound on the ring road — '37! Hospital!'" },
  { id: "route-atomic-east-legon",  originId: "loc-atomic",        destinationId: "loc-east-legon",    transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Atomic junction, short eastbound ride — 'East Legon!'" },
  { id: "route-east-legon-atomic",  originId: "loc-east-legon",    destinationId: "loc-atomic",        transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From East Legon junction, westbound — 'Atomic!'" },
  { id: "route-east-legon-circle",  originId: "loc-east-legon",    destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  4.0, durationMins:  25, whatToLookFor: "From East Legon junction, westbound on the main road — 'Circle! Accra!'" },
  { id: "route-circle-east-legon",  originId: "loc-accra-central", destinationId: "loc-east-legon",    transitType: "Trotro",        estimatedFare:  4.0, durationMins:  25, whatToLookFor: "From Circle northeast side — 'East Legon! Airport!'" },
  { id: "route-east-legon-legon",   originId: "loc-east-legon",    destinationId: "loc-legon",         transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From East Legon, westbound short ride — 'Legon! University Gate!'" },

  // ── Adenta / Spintex ─────────────────────────────────────────────────────────
  { id: "route-adenta-madina",      originId: "loc-adenta",        destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Adenta Barrier, southbound trotros — 'Madina!'" },
  { id: "route-madina-adenta",      originId: "loc-madina",        destinationId: "loc-adenta",        transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Madina station north exit — 'Adenta! Barrier!'" },
  { id: "route-adenta-legon",       originId: "loc-adenta",        destinationId: "loc-legon",         transitType: "Trotro",        estimatedFare:  3.5, durationMins:  25, whatToLookFor: "From Adenta Barrier, southwestbound — 'Legon! University!'" },
  { id: "route-spintex-madina",     originId: "loc-spintex",       destinationId: "loc-madina",        transitType: "Trotro",        estimatedFare:  4.5, durationMins:  30, whatToLookFor: "From Spintex Coca-Cola junction, northbound trotros — 'Madina!'" },
  { id: "route-spintex-circle",     originId: "loc-spintex",       destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  5.5, durationMins:  40, whatToLookFor: "From Spintex junction, southwestbound — 'Circle! Accra!'" },

  // ── West (Kasoa / Mallam / Dansoman / Darkuman / Odorkor / Korle-Bu) ─────────
  { id: "route-kasoa-circle",       originId: "loc-kasoa",         destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare: 12.0, durationMins:  60, whatToLookFor: "From Kasoa lorry park — 'Circle! Accra!' Very frequent, very full." },
  { id: "route-kasoa-kaneshie",     originId: "loc-kasoa",         destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare: 10.0, durationMins:  50, whatToLookFor: "From Kasoa lorry park, some trotros terminate at Kaneshie — ask before boarding" },
  { id: "route-circle-kasoa",       originId: "loc-accra-central", destinationId: "loc-kasoa",         transitType: "Trotro",        estimatedFare: 12.0, durationMins:  60, whatToLookFor: "From Circle west side near Kaneshie road — 'Kasoa! Kasoa!'" },
  { id: "route-kasoa-mallam",       originId: "loc-kasoa",         destinationId: "loc-mallam",        transitType: "Trotro",        estimatedFare:  6.0, durationMins:  30, whatToLookFor: "From Kasoa lorry park, eastbound trotros — 'Mallam! Accra!'" },
  { id: "route-mallam-kasoa",       originId: "loc-mallam",        destinationId: "loc-kasoa",         transitType: "Trotro",        estimatedFare:  6.0, durationMins:  30, whatToLookFor: "From Mallam junction, westbound trotros — 'Kasoa!' Sit tight, long ride." },
  { id: "route-mallam-circle",      originId: "loc-mallam",        destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  4.0, durationMins:  20, whatToLookFor: "From Mallam junction, eastbound trotros — 'Circle! Accra!'" },
  { id: "route-mallam-kaneshie",    originId: "loc-mallam",        destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  3.0, durationMins:  15, whatToLookFor: "From Mallam junction, eastbound short ride — 'Kaneshie!'" },
  { id: "route-circle-mallam",      originId: "loc-accra-central", destinationId: "loc-mallam",        transitType: "Trotro",        estimatedFare:  4.0, durationMins:  20, whatToLookFor: "From Circle west side — 'Mallam! Kasoa!'" },
  { id: "route-dansoman-circle",    originId: "loc-dansoman",      destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  4.5, durationMins:  25, whatToLookFor: "From Eschol Park roundabout, eastbound — 'Circle! Accra!'" },
  { id: "route-dansoman-kaneshie",  originId: "loc-dansoman",      destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  3.0, durationMins:  15, whatToLookFor: "From Eschol Park, northeastbound — 'Kaneshie!'" },
  { id: "route-circle-dansoman",    originId: "loc-accra-central", destinationId: "loc-dansoman",      transitType: "Trotro",        estimatedFare:  4.5, durationMins:  25, whatToLookFor: "From Circle west side — 'Dansoman! Eschol!'" },
  { id: "route-darkuman-circle",    originId: "loc-darkuman",      destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Darkuman junction, southeastbound — 'Circle! Accra!'" },
  { id: "route-darkuman-kaneshie",  originId: "loc-darkuman",      destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Darkuman junction, southbound — 'Kaneshie!'" },
  { id: "route-circle-darkuman",    originId: "loc-accra-central", destinationId: "loc-darkuman",      transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Circle north side — 'Darkuman! Achimota!'" },
  { id: "route-odorkor-circle",     originId: "loc-odorkor",       destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Odorkor junction, eastbound trotros — 'Circle! Accra!'" },
  { id: "route-odorkor-kaneshie",   originId: "loc-odorkor",       destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  2.5, durationMins:  12, whatToLookFor: "From Odorkor, eastbound short ride — 'Kaneshie!'" },
  { id: "route-korle-bu-circle",    originId: "loc-korle-bu",      destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "Opposite hospital main gate — very short ride, trotros pass constantly. 'Circle!'" },
  { id: "route-circle-korle-bu",    originId: "loc-accra-central", destinationId: "loc-korle-bu",      transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Circle west side — 'Korle-Bu! Hospital!'" },
  { id: "route-abossey-circle",     originId: "loc-abossey-okai",  destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  2.5, durationMins:  10, whatToLookFor: "From Abossey Okai junction, eastbound — very short ride to Circle. 'Circle!'" },
  { id: "route-abossey-kaneshie",   originId: "loc-abossey-okai",  destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Abossey Okai, westbound short ride — 'Kaneshie!'" },

  // ── Weija ────────────────────────────────────────────────────────────────────
  { id: "route-weija-kasoa",        originId: "loc-weija",         destinationId: "loc-kasoa",         transitType: "Trotro",        estimatedFare:  4.0, durationMins:  25, whatToLookFor: "From Weija junction, westbound — 'Kasoa!'" },
  { id: "route-weija-kaneshie",     originId: "loc-weija",         destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  5.0, durationMins:  30, whatToLookFor: "From Weija junction, eastbound — 'Kaneshie!'" },
  { id: "route-weija-circle",       originId: "loc-weija",         destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  7.0, durationMins:  45, whatToLookFor: "From Weija junction, direct eastbound — 'Circle! Accra!'" },
  { id: "route-kasoa-weija",        originId: "loc-kasoa",         destinationId: "loc-weija",         transitType: "Trotro",        estimatedFare:  4.0, durationMins:  25, whatToLookFor: "From Kasoa lorry park, eastbound — 'Weija!'" },

  // ── Coastal (Teshie / Nungua / Tema / Ashaiman) ──────────────────────────────
  { id: "route-nungua-teshie",      originId: "loc-nungua",        destinationId: "loc-teshie",        transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Nungua barrier, westbound — 'Teshie!'" },
  { id: "route-teshie-circle",      originId: "loc-teshie",        destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Teshie junction, westbound — 'Circle! Accra!' Very busy at rush hour." },
  { id: "route-nungua-circle",      originId: "loc-nungua",        destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  6.0, durationMins:  45, whatToLookFor: "From Nungua barrier, direct trotros to Circle — 'Circle direct!' on the beach road" },
  { id: "route-circle-teshie",      originId: "loc-accra-central", destinationId: "loc-teshie",        transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Circle east side on the Teshie road — 'Teshie! Nungua!'" },
  { id: "route-tema-circle",        originId: "loc-tema",          destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare: 10.0, durationMins:  60, whatToLookFor: "From Tema Comm. 1 station — 'Circle! Accra!' Very full in mornings." },
  { id: "route-circle-tema",        originId: "loc-accra-central", destinationId: "loc-tema",          transitType: "Trotro",        estimatedFare: 10.0, durationMins:  60, whatToLookFor: "From Circle, board on the Tema road side — 'Tema! Tema!'" },
  { id: "route-ashaiman-tema",      originId: "loc-ashaiman",      destinationId: "loc-tema",          transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Ashaiman lorry station, westbound — 'Tema! Comm. 1!'" },
  { id: "route-tema-ashaiman",      originId: "loc-tema",          destinationId: "loc-ashaiman",      transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Tema Comm. 1, eastbound — 'Ashaiman!'" },
  { id: "route-ashaiman-circle",    originId: "loc-ashaiman",      destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare: 12.0, durationMins:  70, whatToLookFor: "From Ashaiman, long direct ride to Circle — 'Circle! Accra!'" },

  // ── Airport / Osu ─────────────────────────────────────────────────────────────
  { id: "route-osu-circle",         originId: "loc-osu",           destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Danquah Circle Osu, on Oxford Street junction — 'Circle! Accra!'" },
  { id: "route-airport-37",         originId: "loc-airport",       destinationId: "loc-37",            transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "Near Kotoka Airport junction on the ring road — northbound. '37! Hospital!'" },
  { id: "route-airport-circle",     originId: "loc-airport",       destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From the Airport ring road bus stop, southbound — 'Circle! Accra!'" },
  { id: "route-airport-legon",      originId: "loc-airport",       destinationId: "loc-legon",         transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Airport junction, northeast toward Legon — 'Legon! University!'" },

  // ── Nima ────────────────────────────────────────────────────────────────────
  { id: "route-nima-circle",        originId: "loc-nima",          destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Nima junction, southbound — 'Circle! Accra!'" },
  { id: "route-circle-nima",        originId: "loc-accra-central", destinationId: "loc-nima",          transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Circle north side, Ring Road East — 'Nima!'" },
  { id: "route-nima-achimota",      originId: "loc-nima",          destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Nima, northbound trotros — 'Achimota!'" },
  { id: "route-nima-37",            originId: "loc-nima",          destinationId: "loc-37",            transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Nima junction, short southeastbound — '37! Hospital!'" },

  // ── Tudu ─────────────────────────────────────────────────────────────────────
  { id: "route-tudu-circle",        originId: "loc-tudu",          destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  1.5, durationMins:   8, whatToLookFor: "From Tudu terminal, very short westbound ride — 'Circle!'" },
  { id: "route-circle-tudu",        originId: "loc-accra-central", destinationId: "loc-tudu",          transitType: "Trotro",        estimatedFare:  1.5, durationMins:   8, whatToLookFor: "From Circle, eastbound short ride — 'Tudu! Makola!'" },

  // ── Agbogbloshie ─────────────────────────────────────────────────────────────
  { id: "route-agbog-circle",       originId: "loc-agbogbloshie",  destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  1.5, durationMins:   8, whatToLookFor: "From Agbogbloshie market, eastbound — 'Circle! Accra!'" },
  { id: "route-agbog-kaneshie",     originId: "loc-agbogbloshie",  destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  2.0, durationMins:  10, whatToLookFor: "From Agbogbloshie, westbound — 'Kaneshie!'" },
  { id: "route-circle-agbog",       originId: "loc-accra-central", destinationId: "loc-agbogbloshie",  transitType: "Trotro",        estimatedFare:  1.5, durationMins:   8, whatToLookFor: "From Circle west side — 'Agbogbloshie! Kaneshie!'" },

  // ── Bubuashie ────────────────────────────────────────────────────────────────
  { id: "route-bubuashie-kaneshie", originId: "loc-bubuashie",     destinationId: "loc-kaneshie",      transitType: "Trotro",        estimatedFare:  2.0, durationMins:  12, whatToLookFor: "From Bubuashie junction, eastbound — 'Kaneshie!'" },
  { id: "route-bubuashie-circle",   originId: "loc-bubuashie",     destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  3.5, durationMins:  22, whatToLookFor: "From Bubuashie, eastbound — 'Circle! Accra!'" },
  { id: "route-kaneshie-bubuashie", originId: "loc-kaneshie",      destinationId: "loc-bubuashie",     transitType: "Trotro",        estimatedFare:  2.0, durationMins:  12, whatToLookFor: "From Kaneshie lorry park left side — 'Bubuashie! Darkuman!'" },

  // ── Kanda ────────────────────────────────────────────────────────────────────
  { id: "route-kanda-circle",       originId: "loc-kanda",         destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  2.0, durationMins:  12, whatToLookFor: "From Kanda overpass, southbound on the ring road — 'Circle!'" },
  { id: "route-kanda-37",           originId: "loc-kanda",         destinationId: "loc-37",            transitType: "Trotro",        estimatedFare:  1.5, durationMins:   8, whatToLookFor: "From Kanda, short eastbound — '37! Hospital!'" },
  { id: "route-circle-kanda",       originId: "loc-accra-central", destinationId: "loc-kanda",         transitType: "Trotro",        estimatedFare:  2.0, durationMins:  12, whatToLookFor: "From Circle, northbound on the ring road — 'Kanda! Nima!'" },

  // ── Tesano ───────────────────────────────────────────────────────────────────
  { id: "route-tesano-achimota",    originId: "loc-tesano",        destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Tesano junction, northbound — 'Achimota!'" },
  { id: "route-tesano-lapaz",       originId: "loc-tesano",        destinationId: "loc-lapaz",         transitType: "Trotro",        estimatedFare:  2.5, durationMins:  15, whatToLookFor: "From Tesano, northwestbound — 'Lapaz!'" },
  { id: "route-tesano-circle",      originId: "loc-tesano",        destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  3.5, durationMins:  20, whatToLookFor: "From Tesano junction, southbound — 'Circle! Accra!'" },

  // ── Amasaman ────────────────────────────────────────────────────────────────
  { id: "route-amasaman-achimota",  originId: "loc-amasaman",      destinationId: "loc-achimota",      transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Amasaman junction, southbound — 'Achimota! Accra!'" },
  { id: "route-amasaman-pokuase",   originId: "loc-amasaman",      destinationId: "loc-pokuase",       transitType: "Trotro",        estimatedFare:  3.0, durationMins:  20, whatToLookFor: "From Amasaman, southwestbound — 'Pokuase!'" },
  { id: "route-achimota-amasaman",  originId: "loc-achimota",      destinationId: "loc-amasaman",      transitType: "Trotro",        estimatedFare:  5.0, durationMins:  35, whatToLookFor: "From Achimota station, northbound — 'Amasaman! Nsawam!'" },
  { id: "route-amasaman-nsawam",    originId: "loc-amasaman",      destinationId: "loc-nsawam",        transitType: "Intercity Bus", estimatedFare:  8.0, durationMins:  30, whatToLookFor: "From Amasaman, northbound on the Nsawam road — 'Nsawam!'" },

  // ── Nsawam ──────────────────────────────────────────────────────────────────
  { id: "route-nsawam-circle",      originId: "loc-nsawam",        destinationId: "loc-accra-central", transitType: "Intercity Bus", estimatedFare: 15.0, durationMins:  60, whatToLookFor: "From Nsawam station, southbound buses — 'Accra! Circle!' Frequent departures." },
  { id: "route-circle-nsawam",      originId: "loc-accra-central", destinationId: "loc-nsawam",        transitType: "Intercity Bus", estimatedFare: 15.0, durationMins:  60, whatToLookFor: "From Circle northeast or STC area — 'Nsawam! Koforidua!'" },
  { id: "route-stc-nsawam",         originId: "loc-stc-terminal",  destinationId: "loc-nsawam",        transitType: "Intercity Bus", estimatedFare: 15.0, durationMins:  60, whatToLookFor: "From Accra STC Terminal, board northbound buses toward Koforidua — alight at Nsawam." },
  { id: "route-nsawam-stc",         originId: "loc-nsawam",        destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare: 15.0, durationMins:  60, whatToLookFor: "From Nsawam station, southbound bus to Accra STC Terminal." },

  // ── Winneba ──────────────────────────────────────────────────────────────────
  { id: "route-stc-winneba",        originId: "loc-stc-terminal",  destinationId: "loc-winneba",       transitType: "Intercity Bus", estimatedFare: 35.0, durationMins:  90, whatToLookFor: "From STC terminal, board Cape Coast bus and alight at Winneba. ~1.5 hours." },
  { id: "route-winneba-stc",        originId: "loc-winneba",       destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare: 35.0, durationMins:  90, whatToLookFor: "From Winneba lorry station, board Accra-bound bus. Frequent VIP/STC departures." },
  { id: "route-winneba-cape-coast", originId: "loc-winneba",       destinationId: "loc-cape-coast",    transitType: "Intercity Bus", estimatedFare: 20.0, durationMins:  60, whatToLookFor: "From Winneba, westbound — 'Cape Coast!' Short hop along the coastal highway." },
  { id: "route-cape-coast-winneba", originId: "loc-cape-coast",    destinationId: "loc-winneba",       transitType: "Intercity Bus", estimatedFare: 20.0, durationMins:  60, whatToLookFor: "From Cape Coast lorry station, eastbound — 'Winneba! Accra!'" },

  // ── Intercity from Accra STC Terminal ────────────────────────────────────────
  { id: "route-stc-kumasi",         originId: "loc-stc-terminal",  destinationId: "loc-kumasi",        transitType: "Intercity Bus", estimatedFare: 80.0, durationMins: 240, whatToLookFor: "Buy ticket at the STC counter — choose STC, VIP, or VVIP. Buses leave from 4am. Online booking at stcgh.com. Journey is ~4 hours." },
  { id: "route-kumasi-stc",         originId: "loc-kumasi",        destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare: 80.0, durationMins: 240, whatToLookFor: "From Kejetia terminal in Kumasi, buy STC or VIP ticket to Accra. Buses run throughout the day." },
  { id: "route-stc-cape-coast",     originId: "loc-stc-terminal",  destinationId: "loc-cape-coast",    transitType: "Intercity Bus", estimatedFare: 50.0, durationMins: 180, whatToLookFor: "From STC terminal near Circle, buy ticket for Cape Coast. ~3 hours on the coastal highway." },
  { id: "route-cape-coast-stc",     originId: "loc-cape-coast",    destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare: 50.0, durationMins: 180, whatToLookFor: "From Cape Coast lorry station, board VIP or STC bus to Accra. Frequent departures." },
  { id: "route-stc-takoradi",       originId: "loc-stc-terminal",  destinationId: "loc-takoradi",      transitType: "Intercity Bus", estimatedFare: 70.0, durationMins: 240, whatToLookFor: "From STC terminal, board bus to Takoradi (Western Region). ~4 hours. Book in advance." },
  { id: "route-takoradi-stc",       originId: "loc-takoradi",      destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare: 70.0, durationMins: 240, whatToLookFor: "From Takoradi lorry station, board STC or VIP bus to Accra. Several departures daily." },
  { id: "route-stc-koforidua",      originId: "loc-stc-terminal",  destinationId: "loc-koforidua",     transitType: "Intercity Bus", estimatedFare: 35.0, durationMins: 120, whatToLookFor: "From STC terminal or Circle, board trotro/bus to Koforidua. ~2 hours, relatively short." },
  { id: "route-koforidua-stc",      originId: "loc-koforidua",     destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare: 35.0, durationMins: 120, whatToLookFor: "From Koforidua lorry station, board trotro/bus heading to Accra. Frequent service." },
  { id: "route-stc-ho",             originId: "loc-stc-terminal",  destinationId: "loc-ho",            transitType: "Intercity Bus", estimatedFare: 55.0, durationMins: 180, whatToLookFor: "From STC terminal, board bus to Ho (Volta Region). ~3 hours. Scenic route via Adenta." },
  { id: "route-ho-stc",             originId: "loc-ho",            destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare: 55.0, durationMins: 180, whatToLookFor: "From Ho lorry station, board VIP or Metro Mass bus to Accra. Several departures." },
  { id: "route-stc-tamale",         originId: "loc-stc-terminal",  destinationId: "loc-tamale",        transitType: "Intercity Bus", estimatedFare:150.0, durationMins: 480, whatToLookFor: "From STC terminal, book the overnight Tamale bus. ~8 hours. Pack food, buy VIP/VVIP for comfort." },
  { id: "route-tamale-stc",         originId: "loc-tamale",        destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare:150.0, durationMins: 480, whatToLookFor: "From Tamale bus station, board STC or VIP overnight to Accra. Book 1 day ahead." },
  { id: "route-stc-sunyani",        originId: "loc-stc-terminal",  destinationId: "loc-sunyani",       transitType: "Intercity Bus", estimatedFare:120.0, durationMins: 360, whatToLookFor: "From STC terminal, board Sunyani bus via Kumasi. ~6 hours. Book in advance." },
  { id: "route-sunyani-stc",        originId: "loc-sunyani",       destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare:120.0, durationMins: 360, whatToLookFor: "From Sunyani bus station, board Accra bus via Kumasi. Several departures daily." },
  { id: "route-kumasi-sunyani",     originId: "loc-kumasi",        destinationId: "loc-sunyani",       transitType: "Intercity Bus", estimatedFare: 50.0, durationMins: 120, whatToLookFor: "From Kejetia terminal Kumasi, northwestbound — 'Sunyani!'" },
  { id: "route-sunyani-kumasi",     originId: "loc-sunyani",       destinationId: "loc-kumasi",        transitType: "Intercity Bus", estimatedFare: 50.0, durationMins: 120, whatToLookFor: "From Sunyani bus station, southeastbound — 'Kumasi! Kejetia!'" },
  { id: "route-stc-bolgatanga",     originId: "loc-stc-terminal",  destinationId: "loc-bolgatanga",    transitType: "Intercity Bus", estimatedFare:200.0, durationMins: 660, whatToLookFor: "From STC terminal, book the Bolgatanga overnight bus. ~11 hours. Pack food and a blanket." },
  { id: "route-bolgatanga-stc",     originId: "loc-bolgatanga",    destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare:200.0, durationMins: 660, whatToLookFor: "From Bolgatanga bus station, board overnight STC or VIP to Accra. Book well ahead." },
  { id: "route-tamale-bolgatanga",  originId: "loc-tamale",        destinationId: "loc-bolgatanga",    transitType: "Intercity Bus", estimatedFare: 50.0, durationMins: 120, whatToLookFor: "From Tamale bus station, northbound — 'Bolgatanga!' Short hop." },
  { id: "route-bolgatanga-tamale",  originId: "loc-bolgatanga",    destinationId: "loc-tamale",        transitType: "Intercity Bus", estimatedFare: 50.0, durationMins: 120, whatToLookFor: "From Bolgatanga bus station, southbound — 'Tamale!'" },
  { id: "route-stc-wa",             originId: "loc-stc-terminal",  destinationId: "loc-wa",            transitType: "Intercity Bus", estimatedFare:220.0, durationMins: 720, whatToLookFor: "From STC terminal, book the Wa overnight bus. ~12 hours. Bring food and water." },
  { id: "route-wa-stc",             originId: "loc-wa",            destinationId: "loc-stc-terminal",  transitType: "Intercity Bus", estimatedFare:220.0, durationMins: 720, whatToLookFor: "From Wa bus station, board overnight STC to Accra. Book ahead — limited seats." },
  { id: "route-tamale-wa",          originId: "loc-tamale",        destinationId: "loc-wa",            transitType: "Intercity Bus", estimatedFare: 80.0, durationMins: 180, whatToLookFor: "From Tamale bus station, westbound — 'Wa!' About 3 hours." },
  { id: "route-wa-tamale",          originId: "loc-wa",            destinationId: "loc-tamale",        transitType: "Intercity Bus", estimatedFare: 80.0, durationMins: 180, whatToLookFor: "From Wa bus station, eastbound — 'Tamale!'" },

  // ── Circle → STC terminal (short trotro connection) ───────────────────────────
  { id: "route-circle-stc",         originId: "loc-accra-central", destinationId: "loc-stc-terminal",  transitType: "Trotro",        estimatedFare:  2.0, durationMins:   5, whatToLookFor: "The STC terminal is a short walk or 2-minute trotro from Circle. Head toward the motorway." },
  { id: "route-stc-circle",         originId: "loc-stc-terminal",  destinationId: "loc-accra-central", transitType: "Trotro",        estimatedFare:  2.0, durationMins:   5, whatToLookFor: "From STC terminal, take any trotro heading toward Circle. Very short ride." },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌱 Seeding ${LOCATIONS.length} locations + ${ROUTES.length} routes…`);

  // Locations in batches of 5
  for (let i = 0; i < LOCATIONS.length; i += 5) {
    await Promise.all(
      LOCATIONS.slice(i, i + 5).map((loc) =>
        prisma.location.upsert({ where: { id: loc.id }, update: loc, create: loc })
      )
    );
  }
  console.log(`✅ ${LOCATIONS.length} locations done`);

  // Routes sequentially (connection_limit=1)
  let done = 0;
  for (const route of ROUTES) {
    await prisma.route.upsert({ where: { id: route.id }, update: {}, create: route });
    done++;
    if (done % 20 === 0) console.log(`   ${done}/${ROUTES.length} routes…`);
  }
  console.log(`✅ ${ROUTES.length} routes done`);
  console.log("🎉 Ghana's trotro + intercity network is mapped.");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

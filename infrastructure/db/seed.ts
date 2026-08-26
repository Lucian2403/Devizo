/**
 * Seed script: inserts sample Romanian customers and projects.
 * Targets the first organization found in the DB — intended for dev/demo only.
 *
 * Run with:
 *   npx --yes pnpm@9.12.0 tsx infrastructure/db/seed.ts
 */

import { config } from "dotenv";
// Next.js stores secrets in .env.local; load it explicitly for standalone scripts.
config({ path: ".env.local" });
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { asc } from "drizzle-orm";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CUSTOMERS = [
  { name: "Alexandru Popa", contactName: "Alexandru Popa", phone: "+373 69 123 456", email: "alex.popa@gmail.com", preferredLanguage: "ro" },
  { name: "Maria Ionescu", contactName: "Maria Ionescu", phone: "+373 79 234 567", email: "maria.ionescu@yahoo.com", preferredLanguage: "ro" },
  { name: "Dmitri Lungu", contactName: "Dmitri Lungu", phone: "+373 60 345 678", email: "dlungu@mail.ru", preferredLanguage: "ru" },
  { name: "Elena Ciobanu", contactName: "Elena Ciobanu", phone: "+373 69 456 789", preferredLanguage: "ro" },
  { name: "Andrei Mocanu", contactName: "Andrei Mocanu", phone: "+373 78 567 890", email: "a.mocanu@gmail.com", preferredLanguage: "ro" },
  { name: "Natalia Rusu", contactName: "Natalia Rusu", phone: "+373 69 678 901", preferredLanguage: "ro" },
  { name: "Ion Grădinaru", contactName: "Ion Grădinaru", phone: "+40 722 345 678", email: "ion.gradinaru@gmail.com", preferredLanguage: "ro" },
  { name: "Svetlana Botnari", contactName: "Svetlana Botnari", phone: "+373 60 789 012", preferredLanguage: "ru" },
  { name: "Gheorghe Ursachi", contactName: "Gheorghe Ursachi", phone: "+373 69 890 123", email: "g.ursachi@mail.ru", preferredLanguage: "ro" },
  { name: "Cristina Munteanu", contactName: "Cristina Munteanu", phone: "+373 79 901 234", email: "cristina.m@gmail.com", preferredLanguage: "ro" },
  { name: "Vasile Cojocar", contactName: "Vasile Cojocar", phone: "+373 69 012 345", preferredLanguage: "ro" },
  { name: "Oxana Țurcanu", contactName: "Oxana Țurcanu", phone: "+373 60 123 456", preferredLanguage: "ru" },
  { name: "Mircea Florea", contactName: "Mircea Florea", phone: "+40 743 456 789", email: "mircea.florea@gmail.com", preferredLanguage: "ro" },
  { name: "Iulia Balan", contactName: "Iulia Balan", phone: "+373 79 234 567", email: "iulia.balan@yahoo.com", preferredLanguage: "ro" },
  { name: "Radu Condurache", contactName: "Radu Condurache", phone: "+40 761 567 890", preferredLanguage: "ro" },
];

// Projects will be assigned to customers in round-robin order.
const PROJECT_TEMPLATES = [
  { name: "Renovare apartament 3 camere", address: "str. Ștefan cel Mare 42, ap. 7, Chișinău", status: "active", description: "Renovare completă: demontări, șpaclu, vopsitorie, parchet, baie." },
  { name: "Renovare baie + bucătărie", address: "bd. Moscova 18, ap. 23, Chișinău", status: "active", description: "Refacere completă gresie, faianță, sanitare și mobilier de bucătărie." },
  { name: "Amenajare birou etaj 2", address: "str. Mihai Eminescu 5, Chișinău", status: "planned", description: "Compartimentare gips-carton, vopsitorie, pardoseală laminat." },
  { name: "Construcție vilă P+1", address: "com. Cricova, lot 14", status: "planned", description: "Construcție la cheie: fundație, structură, finisaje interioare și exterioare." },
  { name: "Renovare hol și living", address: "str. Trandafirilor 9, ap. 2, Bălți", status: "completed", description: "Șpaclu, glet, vopsitorie pereți și tavan, parchet laminat 65 m²." },
  { name: "Refacere acoperiș terasă", address: "str. Albișoara 31, Chișinău", status: "active", description: "Hidroizolație terasă și reparație strat de finisaj." },
  { name: "Renovare dormitor principal", address: "bd. Renașterii 7, ap. 15, Chișinău", status: "completed", description: "Izolație fonică, gips-carton, parchet stejar, iluminat indirect." },
  { name: "Finisaje interioare casă particulară", address: "com. Durlești, str. Primăverii 3", status: "active", description: "Șpaclu, faianță baie, gresie bucătărie, vopsitorie generală." },
  { name: "Renovare scară bloc", address: "str. Calea Ieșilor 88, Chișinău", status: "planned", description: "Refacere tencuieli, vopsitorie, înlocuire balustrade." },
  { name: "Amenajare spațiu comercial", address: "str. Ismail 44, parter, Chișinău", status: "active", description: "Compartimentări, pardoseală epoxidică, iluminat LED." },
  { name: "Renovare baie — înlocuire sanitare", address: "str. Vasile Lupu 12, ap. 4, Chișinău", status: "completed", description: "Dezafectare completă, faianță nouă, cadă, duș, mobilier." },
  { name: "Izolație termică fațadă", address: "bd. Dacia 55, Chișinău", status: "planned", description: "Placare polistiren 10 cm, tencuială decorativă, vopsitorie." },
  { name: "Amenajare subsol — spațiu tehnic", address: "com. Stăuceni, lot 7", status: "active", description: "Beton șapă, hidroizolație pereți, instalații electrice și sanitare." },
  { name: "Renovare apartament 2 camere — total", address: "str. Columna 29, ap. 11, Chișinău", status: "active", description: "Demontări complete, compartimentare nouă, finisaje premium." },
  { name: "Reparație curentă apartament", address: "str. Florilor 3, ap. 8, Orhei", status: "completed", description: "Revopsire pereți și tavan, înlocuire parchet în 2 camere." },
  { name: "Construcție garaj și terasă", address: "com. Bubuieci, str. Livezilor 2", status: "planned", description: "Garaj zidărie 6×5 m și terasă acoperită 4×6 m." },
  { name: "Modernizare instalație electrică", address: "str. Petru Rareș 19, ap. 6, Chișinău", status: "active", description: "Tablou electric nou, recablare completă, prize și întrerupătoare." },
  { name: "Renovare bucătărie — finisaje", address: "bd. Cuza Vodă 88, ap. 3, Chișinău", status: "completed", description: "Faianță, vopsitorie, schimb chiuvetă și baterie." },
  { name: "Amenajare terasă exterioară", address: "com. Tohatin, lot 22", status: "planned", description: "Pardoseală deck lemn, pergolă, iluminat exterior." },
  { name: "Renovare generală casă — etapă 1", address: "com. Grătiești, str. Trandafirului 1", status: "active", description: "Demontări, șapă nouă, instalații, zidărie despărțitoare." },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  // Find the first organization (the demo account).
  const orgs = await db.query.organizations.findMany({ orderBy: [asc(schema.organizations.createdAt)], limit: 1 });
  if (orgs.length === 0) {
    console.error("No organization found. Sign up first, then run the seed.");
    process.exit(1);
  }
  const org = orgs[0]!;
  console.log(`Seeding into organization: "${org.name}" (${org.id})`);

  // Insert customers.
  const insertedCustomers = await db
    .insert(schema.customers)
    .values(CUSTOMERS.map((c) => ({ ...c, organizationId: org.id })))
    .returning({ id: schema.customers.id });
  console.log(`✓ ${insertedCustomers.length} clienți adăugați`);

  // Insert projects, each linked to a customer in round-robin order.
  const projectValues = PROJECT_TEMPLATES.map((p, i) => ({
    ...p,
    organizationId: org.id,
    customerId: insertedCustomers[i % insertedCustomers.length]!.id,
  }));
  const insertedProjects = await db
    .insert(schema.projects)
    .values(projectValues)
    .returning({ id: schema.projects.id });
  console.log(`✓ ${insertedProjects.length} proiecte adăugate`);

  console.log("Seed complet.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

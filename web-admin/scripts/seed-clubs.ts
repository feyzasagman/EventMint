import { db } from "../lib/firebase";
import { DEMO_CLUBS, seedDemoClubs } from "../lib/demoClubs";

async function main() {
  console.log(`Seeding ${DEMO_CLUBS.length} demo clubs…`);

  const result = await seedDemoClubs(db, { skipExisting: true });

  if (result.created.length > 0) {
    console.log("Created:", result.created.join(", "));
  }
  if (result.skipped.length > 0) {
    console.log("Skipped (already exist):", result.skipped.join(", "));
  }
  if (result.errors.length > 0) {
    for (const item of result.errors) {
      console.error(`Error [${item.id}]:`, item.message);
    }
    process.exitCode = 1;
  }

  if (result.created.length === 0 && result.errors.length === 0) {
    console.log("Nothing to seed — all demo clubs already exist.");
  } else {
    console.log("Seed completed.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

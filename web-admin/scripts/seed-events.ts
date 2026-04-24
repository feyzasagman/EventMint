import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

async function main() {
  console.log("Seeding events…");

  await addDoc(collection(db, "events"), {
    title: "Arduino Atölyesi",
    tags: ["robotik", "STEM"],
    category: "STEM",
    location: "Bilişim Lab",
    startAt: serverTimestamp(),
  });

  await addDoc(collection(db, "events"), {
    title: "Tiyatro Provası",
    tags: ["tiyatro", "Sanat"],
    category: "Sanat",
    location: "Konferans Salonu",
    startAt: serverTimestamp(),
  });

  console.log("Seed completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

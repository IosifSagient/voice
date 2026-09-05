// THROWAWAY dev helper — prints one valid share link to the console.
// Not committed, not imported by anything else. Run with:
//   npx tsx scripts/printShareLink.ts
import { encodeShare } from "../src/services/shareCodec";
import type { ExtractedNote } from "../src/services/extraction";

const extraction: ExtractedNote = {
  summary: "Θύμισε στον Γιώργο να στείλει το email την Τετάρτη",
  people: ["Γιώργος"],
  topics: ["δουλειά"],
  action_items: [
    {
      text: "Αποστολή email στον προϊστάμενο",
      due_date: "2026-09-09",
      due_time: "10:00",
      all_day: false,
    },
  ],
};

const transcript =
  "Μίλησα με τον Γιώργο σήμερα και μου είπε ότι πρέπει να στείλουμε το email " +
  "στον προϊστάμενο μέχρι την Τετάρτη το πρωί, αλλιώς θα χάσουμε την προθεσμία.";

const result = encodeShare(extraction, transcript);

if (result.ok) {
  console.log("https://iosifsagient.github.io/heyLisa/s#" + result.fragment);
  console.log("meta:", result.meta);
} else {
  console.log("encodeShare failed:", result.reason);
}

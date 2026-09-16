import { openDatabase } from "../lib/db/database";
import { runMigrations } from "../lib/db/migrations";

const db = openDatabase();
const result = runMigrations(db);
db.close();

console.log(`migrations applied: ${result.applied.length ? result.applied.join(", ") : "none"}`);
console.log(`migrations already applied: ${result.skipped.length ? result.skipped.join(", ") : "none"}`);

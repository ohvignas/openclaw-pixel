import { defineConfig } from "vitest/config";
import path from "path";

// Set DATABASE_URL to an absolute path so it works regardless of cwd
// The DB lives at packages/backend/prisma/data/openclaw.db
const dbPath = path.resolve(__dirname, "prisma/data/openclaw.db");
process.env.DATABASE_URL = `file:${dbPath}`;

export default defineConfig({
  test: {
    environment: "node",
  },
});

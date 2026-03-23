import crypto from "crypto";
import app from "./app";
import { logger } from "./lib/logger";
import { db, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedDefaultAdmin() {
  try {
    const existing = await db.select({ id: adminsTable.id }).from(adminsTable).limit(1);
    if (existing.length > 0) return;

    const username = process.env.DEFAULT_ADMIN_USERNAME || "mohmmed";
    const password = process.env.DEFAULT_ADMIN_PASSWORD || "ZVwas5183";
    const salt = crypto.randomBytes(32).toString("hex");
    const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");

    await db.insert(adminsTable).values({
      username,
      passwordHash,
      salt,
      role: "superadmin",
      isActive: true,
      permissions: JSON.stringify([]),
    });
    logger.info({ username }, "Default admin created");
  } catch (err) {
    logger.error({ err }, "Failed to seed default admin");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedDefaultAdmin();
});

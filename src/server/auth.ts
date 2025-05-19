import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

export async function ensureUserExists() {
  const { userId } = await auth();

  if (!userId) return null;

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
  });

  // If user doesn't exist, create them
  if (!existingUser) {
    await db.insert(users).values({
      id: userId,
    });
  }

  return userId;
}

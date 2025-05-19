import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bases, views, tables } from "~/server/db/schema";

export const baseRouter = createTRPCRouter({
  // Create a new base
  create: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color hex code"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [newBase] = await ctx.db
        .insert(bases)
        .values({
          id: input.id,
          name: "Untitled Base", // Default name that every bases use
          color: input.color,
          user_id: ctx.auth.userId,
        })
        .returning();

      return newBase;
    }),

  // Get all bases for the current user
  getAllByLastUpdated: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Query bases for current user, ordered by most recently updated first
      const userBases = await ctx.db
        .select()
        .from(bases)
        .where(eq(bases.user_id, ctx.auth.userId))
        .orderBy(desc(bases.updated_at));

      return userBases;
    } catch (error) {
      console.error("Error fetching bases:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch bases",
      });
    }
  }),

  // Get the base name and color by id
  getNameAndColorById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const baseNameAndColor = await ctx.db.query.bases.findFirst({
        where: eq(bases.id, input.id),
        columns: {
          name: true,
          color: true,
        },
      });
      return baseNameAndColor;
    }),

  // Update a base name
  updateName: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [updatedBase] = await ctx.db
          .update(bases)
          .set({ name: input.name })
          .where(eq(bases.id, input.id))
          .returning();

        return updatedBase;
      } catch (error) {
        console.error("Error updating base name:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update base name",
        });
      }
    }),

  // Delete a base by id, also delete all things associated with it in order
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.delete(views).where(eq(views.base_id, input.id));
        await ctx.db.delete(tables).where(eq(tables.base_id, input.id));
        await ctx.db.delete(bases).where(eq(bases.id, input.id));
      } catch (error) {
        console.error("Error deleting base:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete base",
        });
      }
    }),
});

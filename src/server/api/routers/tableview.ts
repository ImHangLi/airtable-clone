import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { tables, views } from "~/server/db/schema";

export const tableViewRouter = createTRPCRouter({
  createDefault: protectedProcedure
    .input(
      z.object({
        tableName: z.string(),
        viewName: z.string(),
        baseId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
        const [table] = await ctx.db
          .insert(tables)
          .values({
            name: input.tableName,
            base_id: input.baseId,
          })
          .returning();

        if (!table) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create table",
          });
        }

        const [view] = await ctx.db
          .insert(views)
          .values({
            name: input.viewName,
            table_id: table.id,
            base_id: input.baseId,
            config: {
              type: "grid",
            },
          })
          .returning();

        if (!view) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create view",
          });
        }

      return { table, view };
    }),

  // Get the latest table and view for a base, update base last updated
  getLatest: protectedProcedure
    .input(
      z.object({
        baseId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [table] = await ctx.db
        .select()
        .from(tables)
        .where(eq(tables.base_id, input.baseId))
        .orderBy(desc(tables.created_at))
        .limit(1);

      if (!table) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Table not found",
        });
      }

      const [view] = await ctx.db
        .select()
        .from(views)
        .where(eq(views.table_id, table.id))
        .orderBy(desc(views.created_at))
        .limit(1);

      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }

      return { table, view };
    }),
});

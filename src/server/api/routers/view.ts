import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { views } from "~/server/db/schema";
import type { FilterConfig } from "~/types/filtering";
import type { SortConfig } from "~/types/sorting";
import { tables } from "~/server/db/schema";

const getViewSchema = z.object({
  viewId: z.string().uuid("Invalid view ID"),
});

const getViewWithValidationSchema = z.object({
  viewId: z.string().uuid("Invalid view ID"),
  tableId: z.string().uuid("Invalid table ID"),
});

const updateFilterSchema = z.object({
  viewId: z.string().uuid("Invalid view ID"),
  filter: z.custom<FilterConfig[]>(),
});

const updateSortSchema = z.object({
  viewId: z.string().uuid("Invalid view ID"),
  sort: z.custom<SortConfig[]>(),
});

const updateHiddenColumnSchema = z.object({
  viewId: z.string().uuid("Invalid view ID"),
  hiddenColumns: z.array(z.string()),
});

const getViewsByTableSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

const createViewSchema = z.object({
  name: z.string().min(1, "View name is required"),
  tableId: z.string().uuid("Invalid table ID"),
  baseId: z.string().uuid("Invalid base ID"),
});

const updateViewNameSchema = z.object({
  viewId: z.string().uuid("Invalid view ID"),
  name: z.string().min(1, "View name is required"),
});

const deleteViewSchema = z.object({
  viewId: z.string().uuid("Invalid view ID"),
});

const validateViewIntegritySchema = z.object({
  baseId: z.string().uuid("Invalid base ID"),
});

export const viewRouter = createTRPCRouter({
  // Get view (no validation - for backwards compatibility)
  getView: protectedProcedure
    .input(getViewSchema)
    .query(async ({ ctx, input }) => {
      try {
        const view = await ctx.db.query.views.findFirst({
          where: eq(views.id, input.viewId),
          columns: {
            id: true,
            name: true,
            table_id: true,
            base_id: true,
            filters: true,
            sorts: true,
            hiddenColumns: true,
          },
        });

        if (!view) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "View not found",
          });
        }

        return {
          id: view.id,
          name: view.name,
          table_id: view.table_id,
          base_id: view.base_id,
          filters: view.filters,
          sorts: view.sorts,
          hiddenColumns: view.hiddenColumns,
        };
      } catch (error) {
        console.error("Error getting view:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get view",
        });
      }
    }),

  // Get view with table validation - ensures view belongs to the specified table
  getViewWithValidation: protectedProcedure
    .input(getViewWithValidationSchema)
    .query(async ({ ctx, input }) => {
      try {
        const view = await ctx.db.query.views.findFirst({
          where: eq(views.id, input.viewId),
          columns: {
            id: true,
            name: true,
            table_id: true,
            base_id: true,
            filters: true,
            sorts: true,
            hiddenColumns: true,
          },
        });

        if (!view) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "View not found",
          });
        }

        // Validate that the view belongs to the specified table
        if (view.table_id !== input.tableId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "View does not belong to the specified table",
          });
        }

        return {
          id: view.id,
          name: view.name,
          table_id: view.table_id,
          base_id: view.base_id,
          filters: view.filters,
          sorts: view.sorts,
          hiddenColumns: view.hiddenColumns,
        };
      } catch (error) {
        console.error("Error getting view:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get view",
        });
      }
    }),

  updateFilter: protectedProcedure
    .input(updateFilterSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedView = await ctx.db
          .update(views)
          .set({
            filters: input.filter,
          })
          .where(eq(views.id, input.viewId))
          .returning({
            id: views.id,
            filters: views.filters,
          });

        if (!updatedView) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update view",
          });
        }

        return updatedView;
      } catch (error) {
        console.error("Error updating view:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update view",
        });
      }
    }),

  updateSort: protectedProcedure
    .input(updateSortSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedView = await ctx.db
          .update(views)
          .set({
            sorts: input.sort,
          })
          .where(eq(views.id, input.viewId))
          .returning({
            id: views.id,
            sorts: views.sorts,
          });

        if (!updatedView) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update view",
          });
        }

        return updatedView;
      } catch (error) {
        console.error("Error updating view:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update view",
        });
      }
    }),

  updateHiddenColumn: protectedProcedure
    .input(updateHiddenColumnSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updatedView = await ctx.db
          .update(views)
          .set({
            hiddenColumns: input.hiddenColumns,
          })
          .where(eq(views.id, input.viewId))
          .returning({
            id: views.id,
            hiddenColumns: views.hiddenColumns,
          });

        if (!updatedView) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update view",
          });
        }

        return updatedView;
      } catch (error) {
        console.error("Error updating view:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update view",
        });
      }
    }),

  // Get views by table
  getViewsByTable: protectedProcedure
    .input(getViewsByTableSchema)
    .query(async ({ ctx, input }) => {
      try {
        const viewList = await ctx.db.query.views.findMany({
          where: eq(views.table_id, input.tableId),
          columns: {
            id: true,
            name: true,
            table_id: true,
            base_id: true,
            filters: true,
            sorts: true,
            hiddenColumns: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: (views, { asc }) => [asc(views.created_at)],
        });

        return viewList;
      } catch (error) {
        console.error("Error getting views by table:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get views",
        });
      }
    }),

  // Create view
  createView: protectedProcedure
    .input(createViewSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [newView] = await ctx.db
          .insert(views)
          .values({
            name: input.name,
            table_id: input.tableId,
            base_id: input.baseId,
            filters: [],
            sorts: [],
            hiddenColumns: [],
          })
          .returning({
            id: views.id,
            name: views.name,
            table_id: views.table_id,
            base_id: views.base_id,
            filters: views.filters,
            sorts: views.sorts,
            hiddenColumns: views.hiddenColumns,
            created_at: views.created_at,
            updated_at: views.updated_at,
          });

        if (!newView) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create view",
          });
        }

        return newView;
      } catch (error) {
        console.error("Error creating view:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create view",
        });
      }
    }),

  // Update view (rename)
  updateViewName: protectedProcedure
    .input(updateViewNameSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [updatedView] = await ctx.db
          .update(views)
          .set({
            name: input.name,
            updated_at: new Date(),
          })
          .where(eq(views.id, input.viewId))
          .returning({
            id: views.id,
            name: views.name,
            table_id: views.table_id,
            base_id: views.base_id,
            filters: views.filters,
            sorts: views.sorts,
            hiddenColumns: views.hiddenColumns,
            created_at: views.created_at,
            updated_at: views.updated_at,
          });

        if (!updatedView) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update view",
          });
        }

        return updatedView;
      } catch (error) {
        console.error("Error updating view:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update view",
        });
      }
    }),

  // Delete view
  deleteView: protectedProcedure
    .input(deleteViewSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Check if this is the last view for the table
        await ctx.db
          .select({ count: views.id })
          .from(views)
          .where(
            eq(
              views.table_id,
              ctx.db
                .select({ table_id: views.table_id })
                .from(views)
                .where(eq(views.id, input.viewId))
                .limit(1),
            ),
          );

        // First get the table_id for the view being deleted
        const [viewToDelete] = await ctx.db
          .select({ table_id: views.table_id })
          .from(views)
          .where(eq(views.id, input.viewId))
          .limit(1);

        if (!viewToDelete) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "View not found",
          });
        }

        // Count how many views exist for this table
        const viewCount = await ctx.db
          .select()
          .from(views)
          .where(eq(views.table_id, viewToDelete.table_id));

        // Don't allow deletion if this is the last view
        if (viewCount.length <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot delete the last view. A table must have at least one view.",
          });
        }

        // Delete the view
        const [deletedView] = await ctx.db
          .delete(views)
          .where(eq(views.id, input.viewId))
          .returning({
            id: views.id,
            name: views.name,
            table_id: views.table_id,
          });

        if (!deletedView) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete view",
          });
        }

        return deletedView;
      } catch (error) {
        console.error("Error deleting view:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete view",
        });
      }
    }),

  // Validate view integrity - check for orphaned views or incorrect relationships
  validateViewIntegrity: protectedProcedure
    .input(validateViewIntegritySchema)
    .query(async ({ ctx, input }) => {
      try {
        // Find views that don't have corresponding tables
        const orphanedViews = await ctx.db
          .select({
            view_id: views.id,
            view_name: views.name,
            table_id: views.table_id,
          })
          .from(views)
          .leftJoin(tables, eq(views.table_id, tables.id))
          .where(eq(views.base_id, input.baseId));

        // Filter out the ones where table doesn't exist
        const invalidViews = orphanedViews.filter(
          (row) => !row.table_id || row.table_id === null,
        );

        // Find views that belong to different bases than their tables
        const crossBaseViews = await ctx.db
          .select({
            view_id: views.id,
            view_name: views.name,
            view_base_id: views.base_id,
            table_base_id: tables.base_id,
          })
          .from(views)
          .innerJoin(tables, eq(views.table_id, tables.id))
          .where(eq(views.base_id, input.baseId));

        const inconsistentViews = crossBaseViews.filter(
          (row) => row.view_base_id !== row.table_base_id,
        );

        return {
          totalViews: orphanedViews.length,
          invalidViews,
          inconsistentViews,
          isValid: invalidViews.length === 0 && inconsistentViews.length === 0,
        };
      } catch (error) {
        console.error("Error validating view integrity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to validate view integrity",
        });
      }
    }),
});

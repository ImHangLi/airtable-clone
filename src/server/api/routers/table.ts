import { eq, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  tables,
  views,
  columns,
  rows,
  cells,
  type ColumnType,
  type SortDirection,
} from "~/server/db/schema";
import { faker } from "@faker-js/faker";
import { z } from "zod";
import type { FilterConfig } from "~/types/filtering";
import type { SortConfig } from "~/types/sorting";

// Table-related schemas and types
export const createDefaultTableSchema = z.object({
  tableName: z.string().min(1, "Table name is required"),
  viewName: z.string().min(1, "View name is required"),
  baseId: z.string().uuid("Invalid base ID"),
});

export const getLatestSchema = z.object({
  baseId: z.string().uuid("Invalid base ID"),
});

export const getTablesByBaseSchema = z.object({
  baseId: z.string().uuid("Invalid base ID"),
});

export const createTableSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  baseId: z.string().uuid("Invalid base ID"),
});

export const updateTableNameSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
  name: z.string().min(1, "Table name is required"),
});

export const deleteTableSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

const getTableDefaultViewSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

export type TableWithView = {
  table: {
    id: string;
    name: string;
    base_id: string;
    created_at: Date;
    updated_at: Date;
  };
  view: {
    id: string;
    name: string;
    table_id: string;
    base_id: string;
    filters: FilterConfig[];
    sorts: SortConfig[];
    hiddenColumns: string[];
    created_at: Date;
    updated_at: Date;
  };
};

export const tableRouter = createTRPCRouter({
  // Create a new table with default structure and sample data
  createDefault: protectedProcedure
    .input(createDefaultTableSchema)
    .mutation(async ({ ctx, input }): Promise<TableWithView> => {
      try {
        // Create table
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

        // Create default columns directly in procedure
        const defaultColumns = [
          { name: "Name", type: "text" as ColumnType },
          { name: "Age", type: "number" as ColumnType },
        ];

        const columnIds = defaultColumns.map(() => crypto.randomUUID());

        await ctx.db.insert(columns).values(
          defaultColumns.map((column, index) => ({
            id: columnIds[index]!,
            base_id: input.baseId,
            table_id: table.id,
            name: column.name,
            type: column.type,
            position: index,
            is_primary: index === 0,
            sort: "asc" as SortDirection,
          })),
        );

        // Create default view with new schema
        const [view] = await ctx.db
          .insert(views)
          .values({
            name: input.viewName,
            table_id: table.id,
            base_id: input.baseId,
            filters: [],
            sorts: [],
            hiddenColumns: [],
          })
          .returning();

        if (!view) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create view",
          });
        }

        // Create sample data directly in procedure
        const [nameColumnId, ageColumnId] = columnIds;
        const rowCount = 25;
        const rowData = [];
        const cellData = [];

        for (let i = 0; i < rowCount; i++) {
          const rowId = crypto.randomUUID();
          rowData.push({
            id: rowId,
            table_id: table.id,
            base_id: input.baseId,
          });

          const name = faker.person.fullName();
          const age = faker.number.int({ min: 18, max: 80 });

          cellData.push(
            {
              row_id: rowId,
              column_id: nameColumnId!,
              base_id: input.baseId,
              value_text: name,
              value_number: null,
            },
            {
              row_id: rowId,
              column_id: ageColumnId!,
              base_id: input.baseId,
              value_text: null,
              value_number: age,
            },
          );
        }

        await ctx.db.insert(rows).values(rowData);
        await ctx.db.insert(cells).values(cellData);

        return { table, view };
      } catch (error) {
        console.error("Error creating default table:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create table and view",
        });
      }
    }),

  // Get the most recent table and view for a base
  getLatest: protectedProcedure
    .input(getLatestSchema)
    .query(async ({ ctx, input }): Promise<TableWithView | null> => {
      try {
        // Get the most recent table
        const [table] = await ctx.db
          .select()
          .from(tables)
          .where(eq(tables.base_id, input.baseId))
          .orderBy(desc(tables.created_at))
          .limit(1);

        if (!table) {
          return null;
        }

        // Get the most recent view for the table
        const [view] = await ctx.db
          .select()
          .from(views)
          .where(eq(views.table_id, table.id))
          .orderBy(desc(views.created_at))
          .limit(1);

        if (!view) {
          return null;
        }

        return { table, view };
      } catch (error) {
        console.error("Error getting latest table:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get latest table and view",
        });
      }
    }),

  // Get the default/latest view for a specific table
  getTableDefaultView: protectedProcedure
    .input(getTableDefaultViewSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Get the table first to ensure it exists
        const [table] = await ctx.db
          .select()
          .from(tables)
          .where(eq(tables.id, input.tableId))
          .limit(1);

        if (!table) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Table not found",
          });
        }

        // Get the most recent view for this specific table
        const [view] = await ctx.db
          .select()
          .from(views)
          .where(eq(views.table_id, input.tableId))
          .orderBy(desc(views.created_at))
          .limit(1);

        if (!view) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No views found for this table",
          });
        }

        return { table, view };
      } catch (error) {
        console.error("Error getting table default view:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get table default view",
        });
      }
    }),

  // Get all tables for a base
  getTablesByBase: protectedProcedure
    .input(getTablesByBaseSchema)
    .query(async ({ ctx, input }) => {
      try {
        const tableList = await ctx.db.query.tables.findMany({
          where: eq(tables.base_id, input.baseId),
          columns: {
            id: true,
            name: true,
            base_id: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: (tables, { asc }) => [asc(tables.created_at)],
        });

        return tableList;
      } catch (error) {
        console.error("Error getting tables by base:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get tables",
        });
      }
    }),

  // Create a new table with default view and columns
  createTable: protectedProcedure
    .input(createTableSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Create table
        const [table] = await ctx.db
          .insert(tables)
          .values({
            name: input.name,
            base_id: input.baseId,
          })
          .returning();

        if (!table) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create table",
          });
        }

        // Create default columns
        const defaultColumns = [
          { name: "Name", type: "text" as ColumnType },
          { name: "Age", type: "number" as ColumnType },
        ];

        const columnIds = defaultColumns.map(() => crypto.randomUUID());

        await ctx.db.insert(columns).values(
          defaultColumns.map((column, index) => ({
            id: columnIds[index]!,
            base_id: input.baseId,
            table_id: table.id,
            name: column.name,
            type: column.type,
            position: index,
            is_primary: index === 0,
            sort: "asc" as SortDirection,
          })),
        );

        // Create default view
        const [view] = await ctx.db
          .insert(views)
          .values({
            name: "Grid view",
            table_id: table.id,
            base_id: input.baseId,
            filters: [],
            sorts: [],
            hiddenColumns: [],
          })
          .returning();

        if (!view) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create default view",
          });
        }

        // Create sample data directly in procedure
        const [nameColumnId, notesColumnId] = columnIds;
        const rowCount = 5; // Fewer rows for new tables
        const rowData = [];
        const cellData = [];

        for (let i = 0; i < rowCount; i++) {
          const rowId = crypto.randomUUID();
          rowData.push({
            id: rowId,
            table_id: table.id,
            base_id: input.baseId,
          });

          const name = faker.person.fullName();
          const age = faker.number.int({ min: 18, max: 80 });

          cellData.push(
            {
              row_id: rowId,
              column_id: nameColumnId!,
              base_id: input.baseId,
              value_text: name,
              value_number: null,
            },
            {
              row_id: rowId,
              column_id: notesColumnId!,
              base_id: input.baseId,
              value_text: null,
              value_number: age,
            },
          );
        }

        await ctx.db.insert(rows).values(rowData);
        await ctx.db.insert(cells).values(cellData);

        return {
          table,
          view,
        };
      } catch (error) {
        console.error("Error creating table:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create table",
        });
      }
    }),

  // Update table name
  updateTableName: protectedProcedure
    .input(updateTableNameSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [updatedTable] = await ctx.db
          .update(tables)
          .set({
            name: input.name,
          })
          .where(eq(tables.id, input.tableId))
          .returning({
            id: tables.id,
            name: tables.name,
            base_id: tables.base_id,
            created_at: tables.created_at,
            updated_at: tables.updated_at,
          });

        if (!updatedTable) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update table name",
          });
        }

        return updatedTable;
      } catch (error) {
        console.error("Error updating table name:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update table name",
        });
      }
    }),

  // Delete table
  deleteTable: protectedProcedure
    .input(deleteTableSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // First get the base_id for the table being deleted
        const [tableToDelete] = await ctx.db
          .select({ base_id: tables.base_id })
          .from(tables)
          .where(eq(tables.id, input.tableId))
          .limit(1);

        if (!tableToDelete) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Table not found",
          });
        }

        // Count how many tables exist for this base
        const tableCount = await ctx.db
          .select()
          .from(tables)
          .where(eq(tables.base_id, tableToDelete.base_id));

        // Don't allow deletion if this is the last table
        if (tableCount.length <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot delete the last table. A base must have at least one table.",
          });
        }

        // Delete in the correct order using efficient queries

        // 1. Delete views for this table
        await ctx.db.delete(views).where(eq(views.table_id, input.tableId));

        // 2. Delete cells using a subquery to avoid parameter limits
        await ctx.db
          .delete(cells)
          .where(
            inArray(
              cells.row_id,
              ctx.db
                .select({ id: rows.id })
                .from(rows)
                .where(eq(rows.table_id, input.tableId)),
            ),
          );

        // 3. Delete rows for this table
        await ctx.db.delete(rows).where(eq(rows.table_id, input.tableId));

        // 4. Delete columns for this table
        await ctx.db.delete(columns).where(eq(columns.table_id, input.tableId));

        // 5. Delete the table itself
        const [deletedTable] = await ctx.db
          .delete(tables)
          .where(eq(tables.id, input.tableId))
          .returning({
            id: tables.id,
            name: tables.name,
            base_id: tables.base_id,
          });

        if (!deletedTable) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete table",
          });
        }

        return deletedTable;
      } catch (error) {
        console.error("Error deleting table:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete table",
        });
      }
    }),
});

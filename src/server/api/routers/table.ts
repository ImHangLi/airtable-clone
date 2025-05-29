import { eq, desc } from "drizzle-orm";
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
import { randomUUID } from "crypto";
import { faker } from "@faker-js/faker";
import {
  createDefaultTableSchema,
  getLatestSchema,
  type TableWithView,
} from "./shared/types";

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

        const columnIds = defaultColumns.map(() => randomUUID());

        await ctx.db.insert(columns).values(
          defaultColumns.map((column, index) => ({
            id: columnIds[index]!,
            base_id: input.baseId,
            table_id: table.id,
            name: column.name,
            type: column.type,
            position: index,
            sort: "asc" as SortDirection,
          })),
        );

        // Create default view
        const [view] = await ctx.db
          .insert(views)
          .values({
            name: input.viewName,
            table_id: table.id,
            base_id: input.baseId,
            config: {
              type: "grid",
              columns: columnIds,
              filters: [],
              sorts: [],
            },
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
          const rowId = randomUUID();
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
});

// Database schema for Airtable Clone
// Built with Drizzle ORM for PostgreSQL

import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgEnum,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { SortConfig } from "~/types/sorting";
import type { FilterConfig } from "~/types/filtering";

/**
 * Multi-project schema setup for Drizzle ORM
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `airtable-clone_${name}`);

// Database Enums
export const columnTypeEnum = pgEnum("column_type", ["text", "number"]);
export const columnSortEnum = pgEnum("column_sort", ["asc", "desc"]);

// Common timestamp fields
const timeStamps = {
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
} as const;

// Core Tables
export const users = createTable("users", {
  id: text("id").primaryKey().notNull(), // Clerk user ID
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const bases = createTable(
  "bases",
  {
    id: uuid("id").primaryKey().defaultRandom().unique().notNull(),
    user_id: text("user_id")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    ...timeStamps,
  },
  (t) => [
    // CRITICAL: For user-base relationship and ordering
    index("idx_bases_user_updated").on(t.user_id, t.updated_at),
  ],
);

export const tables = createTable(
  "tables",
  {
    id: uuid("id").primaryKey().defaultRandom().unique().notNull(),
    base_id: uuid("base_id")
      .references(() => bases.id)
      .notNull(),
    name: text("name").notNull(),
    ...timeStamps,
  },
  (t) => [
    // CRITICAL: For base-table relationship queries
    index("idx_tables_base_id").on(t.base_id),
    // PERFORMANCE: For ordering by creation date
    index("idx_tables_created_at").on(t.created_at),
  ],
);

export const columns = createTable(
  "columns",
  {
    id: uuid("id").primaryKey().defaultRandom().unique().notNull(),
    base_id: uuid("base_id")
      .references(() => bases.id)
      .notNull(),
    table_id: uuid("table_id")
      .references(() => tables.id)
      .notNull(),
    name: text("name").notNull(),
    type: columnTypeEnum("type").notNull(),
    position: doublePrecision("position").notNull().default(0),
    is_visible: boolean("is_visible").notNull().default(true),
    is_primary: boolean("is_primary").notNull().default(false),
    sort: columnSortEnum("sort").notNull().default("asc"),
    ...timeStamps,
  },
  (t) => [
    // CRITICAL: For table-column relationship queries and ordering
    index("idx_columns_table_position").on(t.table_id, t.position),
    // PERFORMANCE: For base-wide column operations
    index("idx_columns_base_id").on(t.base_id),
  ],
);

export const rows = createTable(
  "rows",
  {
    id: uuid("id").primaryKey().defaultRandom().unique().notNull(),
    base_id: uuid("base_id")
      .references(() => bases.id)
      .notNull(),
    table_id: uuid("table_id")
      .references(() => tables.id)
      .notNull(),
    ...timeStamps,
  },
  (t) => [
    // CRITICAL: For table row queries and pagination
    index("idx_rows_table_created").on(t.table_id, t.created_at, t.id),
    // PERFORMANCE: For base-wide operations
    index("idx_rows_base_id").on(t.base_id),
  ],
);

export const cells = createTable(
  "cells",
  {
    base_id: uuid("base_id")
      .references(() => bases.id)
      .notNull(),
    row_id: uuid("row_id")
      .references(() => rows.id)
      .notNull(),
    column_id: uuid("column_id")
      .references(() => columns.id)
      .notNull(),
    value_text: text("value_text"),
    value_number: doublePrecision("value_number"),
  },
  (t) => [
    primaryKey({ columns: [t.row_id, t.column_id] }),

    // CRITICAL: Main data retrieval index - most important for performance
    index("idx_cells_row_batch").on(t.row_id),

    // CRITICAL: Filtering and searching indices
    index("idx_cells_column_text").on(t.column_id, t.value_text),
    index("idx_cells_column_number").on(t.column_id, t.value_number),

    // CRITICAL: Base-wide operations (bulk deletes, base queries)
    index("idx_cells_base_id").on(t.base_id),

    // CRITICAL: Search functionality with case-insensitive pattern matching (ILIKE)
    index("idx_cells_text_ilike").using(
      "btree",
      sql`lower(${t.value_text}) text_pattern_ops`,
    ),
    index("idx_cells_number_search").using(
      "btree",
      sql`lower(CAST(${t.value_number} AS TEXT)) text_pattern_ops`,
    ),

    // PERFORMANCE: Composite index for complex filtering
    index("idx_cells_base_column").on(t.base_id, t.column_id),
  ],
);

export const views = createTable(
  "views",
  {
    id: uuid("id").primaryKey().defaultRandom().unique().notNull(),
    table_id: uuid("table_id")
      .references(() => tables.id)
      .notNull(),
    base_id: uuid("base_id")
      .references(() => bases.id)
      .notNull(),
    name: text("name").notNull(),
    filters: jsonb("filters").notNull().$type<FilterConfig[]>(),
    sorts: jsonb("sorts").notNull().$type<SortConfig[]>(),
    hiddenColumns: jsonb("hiddenColumns").notNull().$type<string[]>(),
    ...timeStamps,
  },
  (t) => [
    // CRITICAL: For table-view relationship queries
    index("idx_views_table_id").on(t.table_id),
    // PERFORMANCE: For base-wide view operations
    index("idx_views_base_id").on(t.base_id),
  ],
);

// Relations for better query performance and type safety
export const userRelations = relations(users, ({ many }) => ({
  bases: many(bases),
}));

export const baseRelations = relations(bases, ({ one, many }) => ({
  user: one(users, { fields: [bases.user_id], references: [users.id] }),
  tables: many(tables),
  columns: many(columns),
  rows: many(rows),
  views: many(views),
}));

export const tableRelations = relations(tables, ({ one, many }) => ({
  base: one(bases, { fields: [tables.base_id], references: [bases.id] }),
  columns: many(columns),
  rows: many(rows),
  views: many(views),
}));

export const columnRelations = relations(columns, ({ one, many }) => ({
  base: one(bases, { fields: [columns.base_id], references: [bases.id] }),
  table: one(tables, { fields: [columns.table_id], references: [tables.id] }),
  cells: many(cells),
}));

export const rowRelations = relations(rows, ({ one, many }) => ({
  base: one(bases, { fields: [rows.base_id], references: [bases.id] }),
  table: one(tables, { fields: [rows.table_id], references: [tables.id] }),
  cells: many(cells),
}));

export const cellRelations = relations(cells, ({ one }) => ({
  base: one(bases, { fields: [cells.base_id], references: [bases.id] }),
  row: one(rows, { fields: [cells.row_id], references: [rows.id] }),
  column: one(columns, { fields: [cells.column_id], references: [columns.id] }),
}));

export const viewRelations = relations(views, ({ one }) => ({
  base: one(bases, { fields: [views.base_id], references: [bases.id] }),
  table: one(tables, { fields: [views.table_id], references: [tables.id] }),
}));

// Type exports for use in application
export type User = typeof users.$inferSelect;
export type Base = typeof bases.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type Column = typeof columns.$inferSelect;
export type Row = typeof rows.$inferSelect;
export type Cell = typeof cells.$inferSelect;
export type View = typeof views.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewBase = typeof bases.$inferInsert;
export type NewTable = typeof tables.$inferInsert;
export type NewColumn = typeof columns.$inferInsert;
export type NewRow = typeof rows.$inferInsert;
export type NewCell = typeof cells.$inferInsert;
export type NewView = typeof views.$inferInsert;

export type ColumnType = (typeof columnTypeEnum.enumValues)[number];
export type SortDirection = (typeof columnSortEnum.enumValues)[number];

// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

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

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `airtable-clone_${name}`);

// Enum
export const columnTypeEnum = pgEnum("column_type", ["text", "number"]);
export const columnSortEnum = pgEnum("column_sort", ["asc", "desc"]);

export const timeStamp = {
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
};

export const users = createTable("users", {
  // This will be the user ID provided by Clerk
  id: text("id").primaryKey().notNull(),
});

export const bases = createTable("bases", {
  id: uuid("id").primaryKey().defaultRandom().unique(),
  user_id: text("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  ...timeStamp,
});

export const tables = createTable("tables", {
  id: uuid("id").primaryKey().defaultRandom().unique(),
  base_id: uuid("base_id")
    .references(() => bases.id)
    .notNull(),
  name: text("name").notNull(),
  ...timeStamp,
});

export const columns = createTable("columns", {
  id: uuid("id").primaryKey().defaultRandom().unique(),
  table_id: uuid("table_id")
    .references(() => tables.id)
    .notNull(),
  name: text("name").notNull(),
  type: columnTypeEnum("type").notNull(),
  is_visible: boolean("is_visible").notNull().default(true),
  sort: columnSortEnum("sort").notNull(),
  ...timeStamp,
});

export const rows = createTable("rows", {
  id: uuid("id").primaryKey().defaultRandom().unique(),
  table_id: uuid("table_id")
    .references(() => tables.id)
    .notNull(),
  ...timeStamp,
});

export const cells = createTable(
  "cells",
  {
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
    // An index for querying cells by text/number within a column.
    index("idx_text").on(t.column_id, t.value_text),
    index("idx_number").on(t.column_id, t.value_number),
  ],
);

export const views = createTable("views", {
  id: uuid("id").primaryKey().defaultRandom().unique(),
  table_id: uuid("table_id")
    .references(() => tables.id)
    .notNull(),
  base_id: uuid("base_id")
    .references(() => bases.id)
    .notNull(),
  name: text("name").notNull(),
  // Using jsonb to store the view config.
  config: jsonb("config").notNull(),
  ...timeStamp,
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  bases: many(bases),
}));

export const baseRelations = relations(bases, ({ one, many }) => ({
  user: one(users, { fields: [bases.user_id], references: [users.id] }),
  tables: many(tables),
}));

export const tableRelations = relations(tables, ({ one, many }) => ({
  base: one(bases, { fields: [tables.base_id], references: [bases.id] }),
  columns: many(columns),
  rows: many(rows),
  views: many(views),
}));

export const columnRelations = relations(columns, ({ one, many }) => ({
  table: one(tables, { fields: [columns.table_id], references: [tables.id] }),
  cells: many(cells),
}));

export const rowRelations = relations(rows, ({ one, many }) => ({
  table: one(tables, { fields: [rows.table_id], references: [tables.id] }),
  cells: many(cells),
}));

export const cellRelations = relations(cells, ({ one }) => ({
  row: one(rows, { fields: [cells.row_id], references: [rows.id] }),
  column: one(columns, { fields: [cells.column_id], references: [columns.id] }),
}));

export const viewRelations = relations(views, ({ one }) => ({
  table: one(tables, { fields: [views.table_id], references: [tables.id] }),
}));

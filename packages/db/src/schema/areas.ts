import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { boards } from "./boards";
import { cards } from "./cards";
import { users } from "./users";

export const areas = pgTable("area", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicId: varchar("publicId", { length: 12 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  colourCode: varchar("colourCode", { length: 12 }),
  createdBy: uuid("createdBy").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt"),
  boardId: bigint("boardId", { mode: "number" })
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  deletedAt: timestamp("deletedAt"),
  deletedBy: uuid("deletedBy").references(() => users.id, {
    onDelete: "set null",
  }),
}).enableRLS();

export const areasRelations = relations(areas, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [areas.createdBy],
    references: [users.id],
    relationName: "areasCreatedByUser",
  }),
  deletedBy: one(users, {
    fields: [areas.deletedBy],
    references: [users.id],
    relationName: "areasDeletedByUser",
  }),
  board: one(boards, {
    fields: [areas.boardId],
    references: [boards.id],
    relationName: "areasBoard",
  }),
  cards: many(cards, { relationName: "cardArea" }),
}));

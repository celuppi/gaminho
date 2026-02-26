import { and, count, eq, inArray, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { areas, cards } from "@kan/db/schema"; // imported cards to update areaId
import { generateUID } from "@kan/shared/utils";

export const getCount = async (db: dbClient) => {
  const result = await db
    .select({ count: count() })
    .from(areas)
    .where(isNull(areas.deletedAt));

  return result[0]?.count ?? 0;
};

export const create = async (
  db: dbClient,
  areaInput: {
    name: string;
    colourCode: string;
    createdBy: string;
    boardId: number;
    cardId?: number;
  },
) => {
  const [result] = await db
    .insert(areas)
    .values({
      publicId: generateUID(),
      name: areaInput.name,
      colourCode: areaInput.colourCode,
      createdBy: areaInput.createdBy,
      boardId: areaInput.boardId,
    })
    .returning({
      id: areas.id,
      publicId: areas.publicId,
      name: areas.name,
      colourCode: areas.colourCode,
    });

  if (areaInput.cardId && result) {
    await db
      .update(cards)
      .set({ areaId: result.id })
      .where(eq(cards.id, areaInput.cardId));
  }

  return result;
};

export const bulkCreate = async (
  db: dbClient,
  areasInput: {
    publicId: string;
    name: string;
    colourCode: string;
    boardId: number;
    createdBy: string;
  }[],
) => {
  const results = await db
    .insert(areas)
    .values(areasInput)
    .returning({ id: areas.id });

  return results;
};

export const getAllByPublicIds = (db: dbClient, areaPublicIds: string[]) => {
  return db.query.areas.findMany({
    columns: {
      id: true,
    },
    where: inArray(areas.publicId, areaPublicIds),
  });
};

export const getByPublicId = async (db: dbClient, areaPublicId: string) => {
  return db.query.areas.findFirst({
    columns: {
      id: true,
      publicId: true,
      name: true,
      colourCode: true,
    },
    where: eq(areas.publicId, areaPublicId),
  });
};

export const update = async (
  db: dbClient,
  areaInput: {
    areaPublicId: string;
    name: string;
    colourCode: string;
  },
) => {
  const [result] = await db
    .update(areas)
    .set({
      name: areaInput.name,
      colourCode: areaInput.colourCode,
    })
    .where(eq(areas.publicId, areaInput.areaPublicId))
    .returning({
      id: areas.id,
      publicId: areas.publicId,
      name: areas.name,
      colourCode: areas.colourCode,
    });

  return result;
};

export const softDelete = async (
  db: dbClient,
  args: {
    areaId: number;
    deletedAt: Date;
    deletedBy: string;
  },
) => {
  const [result] = await db
    .update(areas)
    .set({
      deletedAt: args.deletedAt,
      deletedBy: args.deletedBy,
    })
    .where(and(eq(areas.id, args.areaId), isNull(areas.deletedAt)))
    .returning({ id: areas.id });

  // Disassociate from cards
  if (result) {
    await db
      .update(cards)
      .set({ areaId: null })
      .where(eq(cards.areaId, args.areaId));
  }
  
  return result;
};

export const getWorkspaceAndAreaIdByAreaPublicId = async (
  db: dbClient,
  areaPublicId: string,
) => {
  const result = await db.query.areas.findFirst({
    columns: { id: true },
    where: eq(areas.publicId, areaPublicId),
    with: {
      board: {
        columns: { workspaceId: true },
      },
    },
  });

  return result
    ? {
        id: result.id,
        workspaceId: result.board.workspaceId,
      }
    : null;
};

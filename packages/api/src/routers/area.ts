import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as areaRepo from "@kan/db/repository/area.repo";
import * as boardRepo from "@kan/db/repository/board.repo";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertPermission } from "../utils/permissions";

const areaSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  colourCode: z.string().nullable(),
});

export const areaRouter = createTRPCRouter({
  byPublicId: protectedProcedure
    .meta({
      openapi: {
        summary: "Get an area by public ID",
        method: "GET",
        path: "/areas/{areaPublicId}",
        description: "Retrieves an area by its public ID",
        tags: ["Areas"],
        protect: true,
      },
    })
    .input(z.object({ areaPublicId: z.string().min(12) }))
    .output(areaSchema)
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const area = await areaRepo.getWorkspaceAndAreaIdByAreaPublicId(
        ctx.db,
        input.areaPublicId,
      );

      if (!area)
        throw new TRPCError({
          message: `Area with public ID ${input.areaPublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, area.workspaceId, "board:view");

      const result = await areaRepo.getByPublicId(ctx.db, input.areaPublicId);

      if (!result)
        throw new TRPCError({
          message: `Area with public ID ${input.areaPublicId} not found`,
          code: "NOT_FOUND",
        });

      return {
        publicId: result.publicId,
        name: result.name,
        colourCode: result.colourCode,
      };
    }),
  create: protectedProcedure
    .meta({
      openapi: {
        summary: "Create an area",
        method: "POST",
        path: "/areas",
        description: "Creates a new area",
        tags: ["Areas"],
        protect: true,
      },
    })
    .input(
      z.object({
        name: z.string().min(1).max(36),
        boardPublicId: z.string().min(12),
        colourCode: z.string().length(7),
      }),
    )
    .output(areaSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const board = await boardRepo.getWorkspaceAndBoardIdByBoardPublicId(
        ctx.db,
        input.boardPublicId,
      );

      if (!board)
        throw new TRPCError({
          message: `Board with public ID ${input.boardPublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, board.workspaceId, "board:edit");

      const result = await areaRepo.create(ctx.db, {
        name: input.name,
        colourCode: input.colourCode,
        createdBy: userId,
        boardId: board.id,
      });

      if (!result)
        throw new TRPCError({
          message: `Failed to create area`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return {
        publicId: result.publicId,
        name: result.name,
        colourCode: result.colourCode,
      };
    }),
  update: protectedProcedure
    .meta({
      openapi: {
        summary: "Update an area",
        method: "PUT",
        path: "/areas/{areaPublicId}",
        description: "Updates an area by its public ID",
        tags: ["Areas"],
        protect: true,
      },
    })
    .input(
      z.object({
        areaPublicId: z.string().min(12),
        name: z.string().min(1).max(36),
        colourCode: z.string().length(7),
      }),
    )
    .output(areaSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const area = await areaRepo.getWorkspaceAndAreaIdByAreaPublicId(
        ctx.db,
        input.areaPublicId,
      );

      if (!area)
        throw new TRPCError({
          message: `Area with public ID ${input.areaPublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, area.workspaceId, "board:edit");

      const result = await areaRepo.update(ctx.db, input);

      if (!result)
        throw new TRPCError({
          message: `Failed to update area`,
          code: "INTERNAL_SERVER_ERROR",
        });

      return {
        publicId: result.publicId,
        name: result.name,
        colourCode: result.colourCode,
      };
    }),
  delete: protectedProcedure
    .meta({
      openapi: {
        summary: "Delete an area",
        method: "DELETE",
        path: "/areas/{areaPublicId}",
        description: "Deletes an area by its public ID",
        tags: ["Areas"],
        protect: true,
      },
    })
    .input(z.object({ areaPublicId: z.string().min(12) }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const area = await areaRepo.getWorkspaceAndAreaIdByAreaPublicId(
        ctx.db,
        input.areaPublicId,
      );

      if (!area)
        throw new TRPCError({
          message: `Area with public ID ${input.areaPublicId} not found`,
          code: "NOT_FOUND",
        });
      await assertPermission(ctx.db, userId, area.workspaceId, "board:edit");

      await areaRepo.softDelete(ctx.db, {
        areaId: area.id,
        deletedAt: new Date(),
        deletedBy: userId,
      });

      return { success: true };
    }),
});

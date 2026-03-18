import { env } from "next-runtime-env";

import type { dbClient } from "@kan/db/client";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as memberRepo from "@kan/db/repository/member.repo";
import * as notificationRepo from "@kan/db/repository/notification.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import * as workspaceRepo from "@kan/db/repository/workspace.repo";
import { sendEmail } from "@kan/email";
import { parseMentionsFromHTML } from "@kan/shared/utils";

/**
 * Sends mention notification emails to mentioned members
 * Only sends emails for new mentions (checks notification table to avoid duplicates)
 */
export async function sendMentionEmails({
  db,
  cardPublicId,
  commentHtml,
  commenterUserId,
  commentId,
}: {
  db: dbClient;
  cardPublicId: string;
  commentHtml: string;
  commenterUserId: string;
  commentId?: number;
}) {
  try {
    // Parse mentions from HTML
    const mentionPublicIds = parseMentionsFromHTML(commentHtml);
    if (mentionPublicIds.length === 0) return;

    // Get card with board information
    const card = await cardRepo.getWithListAndMembersByPublicId(db, cardPublicId);
    if (!card?.list.board) return;

    const board = card.list.board;
    const boardName = board.name;
    const cardTitle = card.title;
    const cardId = card.id;

    // Get workspace ID from workspace publicId
    const workspace = await workspaceRepo.getByPublicId(
      db,
      board.workspace.publicId,
    );
    if (!workspace?.id) return;

    const workspaceId = workspace.id;

    // Get commenter information
    const commenter = await userRepo.getById(db, commenterUserId);
    if (!commenter) return;

    const commenterName = commenter.name ?? commenter.email;

    // Get mentioned members with full details (filtered by workspace)
    const membersWithDetails = await memberRepo.getByPublicIdsWithUsers(
      db,
      mentionPublicIds,
      workspaceId,
    );

    // Filter out the commenter
    const membersToNotify = membersWithDetails.filter(
      (member) => member.user?.id !== commenterUserId,
    );

    if (membersToNotify.length === 0) return;

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");
    const cardUrl = `${baseUrl}/cards/${cardPublicId}`;

    // Send emails to all mentioned members (only if notification doesn't exist)
    await Promise.all(
      membersToNotify.map(async (member) => {
        const userId = member.user?.id;
        const email = member.user?.email ?? member.email;

        // Skip pending members (no userId) - they can be mentioned but won't receive emails
        if (!userId || !email) return;

        try {
          // Check if notification already exists for this mention
          const notificationExists = await notificationRepo.exists(db, {
            userId,
            cardId,
            type: "mention",
          });

          // If notification already exists, skip sending email
          if (notificationExists) {
            return;
          }

          // Create notification record
          await notificationRepo.create(db, {
            type: "mention",
            userId,
            cardId,
            commentId,
          });

          // Send email
          await sendEmail(
            email,
            `${commenterName} mencionou você em um comentário no cartão ${cardTitle}`,
            "MENTION",
            {
              commenterName,
              boardName,
              cardTitle,
              cardUrl,
            },
          );
        } catch (error) {
          console.error("Failed to send mention email:", {
            email,
            cardPublicId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  } catch (error) {
    console.error("Error sending mention emails:", {
      cardPublicId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sends notification emails to members added to a card
 */
export async function sendAddedToCardEmails({
  db,
  cardPublicId,
  adderUserId,
  addedMemberPublicIds,
}: {
  db: dbClient;
  cardPublicId: string;
  adderUserId: string;
  addedMemberPublicIds: string[];
}) {
  try {
    if (addedMemberPublicIds.length === 0) return;

    // Get card with board information
    const card = await cardRepo.getWithListAndMembersByPublicId(db, cardPublicId);
    if (!card?.list.board) return;

    const board = card.list.board;
    const boardName = board.name;
    const cardTitle = card.title;

    // Get workspace ID from workspace publicId
    const workspace = await workspaceRepo.getByPublicId(
      db,
      board.workspace.publicId,
    );
    if (!workspace?.id) return;

    const workspaceId = workspace.id;

    // Get adder information
    const adder = await userRepo.getById(db, adderUserId);
    if (!adder) return;

    const adderName = adder.name ?? adder.email;

    // Get added members with full details
    const membersWithDetails = await memberRepo.getByPublicIdsWithUsers(
      db,
      addedMemberPublicIds,
      workspaceId,
    );

    // Filter out the adder themselves (don't send email if they add themselves)
    const membersToNotify = membersWithDetails.filter(
      (member) => member.user?.id !== adderUserId,
    );

    if (membersToNotify.length === 0) return;

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");
    const cardUrl = `${baseUrl}/cards/${cardPublicId}`;

    // Send emails
    await Promise.all(
      membersToNotify.map(async (member) => {
        const userId = member.user?.id;
        const email = member.user?.email ?? member.email;

        // Skip pending members (no userId) - they can be added but won't receive emails
        if (!userId || !email) return;

        try {
          await sendEmail(
            email,
            `${adderName} adicionou você ao cartão ${cardTitle}`,
            "ADDED_TO_CARD",
            {
              adderName,
              boardName,
              cardTitle,
              cardUrl,
            },
          );
        } catch (error) {
          console.error("Failed to send added to card email:", {
            email,
            cardPublicId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  } catch (error) {
    console.error("Error sending added to card emails:", {
      cardPublicId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sends notification emails to the removed member and all remaining members
 */
export async function sendRemovedFromCardEmails({
  db,
  cardPublicId,
  removerUserId,
  removedMemberPublicId,
}: {
  db: dbClient;
  cardPublicId: string;
  removerUserId: string;
  removedMemberPublicId: string;
}) {
  try {
    // Get card with board information
    const card = await cardRepo.getWithListAndMembersByPublicId(db, cardPublicId);
    if (!card?.list.board) return;

    const board = card.list.board;
    const boardName = board.name;
    const cardTitle = card.title;

    const workspace = await workspaceRepo.getByPublicId(
      db,
      board.workspace.publicId,
    );
    if (!workspace?.id) return;
    const workspaceId = workspace.id;

    // Get remover information
    const remover = await userRepo.getById(db, removerUserId);
    if (!remover) return;
    const removerName = remover.name ?? remover.email;

    // Get removed member details
    const [removedMemberDetails] = await memberRepo.getByPublicIdsWithUsers(
      db,
      [removedMemberPublicId],
      workspaceId,
    );

    if (!removedMemberDetails) return;
    const removedUserName = removedMemberDetails.user?.name ?? removedMemberDetails.email;

    // Build the list of publicIds of people to notify
    // Remaining members + the removed member
    const remainingMemberPublicIds = card.members
      .filter((m) => m.deletedAt === null)
      .map((m) => m.publicId);
      
    const memberPublicIdsToNotify = [...remainingMemberPublicIds, removedMemberPublicId];

    // Get full details
    const membersWithDetails = await memberRepo.getByPublicIdsWithUsers(
      db,
      memberPublicIdsToNotify,
      workspaceId,
    );

    // Filter out the person who did the removal
    const membersToNotify = membersWithDetails.filter(
      (member) => member.user?.id !== removerUserId,
    );

    if (membersToNotify.length === 0) return;

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");
    const cardUrl = `${baseUrl}/cards/${cardPublicId}`;

    await Promise.all(
      membersToNotify.map(async (member) => {
        const userId = member.user?.id;
        const email = member.user?.email ?? member.email;

        // Skip pending members (no userId) - they can be added but won't receive emails
        if (!userId || !email) return;

        try {
          await sendEmail(
            email,
            `${removedUserName} foi removido(a) do cartão ${cardTitle}`,
            "REMOVED_FROM_CARD",
            {
              removerName,
              removedUserName,
              boardName,
              cardTitle,
              cardUrl,
            },
          );
        } catch (error) {
          console.error("Failed to send removed from card email:", {
            email,
            cardPublicId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  } catch (error) {
    console.error("Error sending removed from card emails:", {
      cardPublicId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sends notification emails to all current members when a card is updated
 */
export async function sendCardUpdatedEmails({
  db,
  cardPublicId,
  updaterUserId,
  changesSummary,
}: {
  db: dbClient;
  cardPublicId: string;
  updaterUserId: string;
  changesSummary: string;
}) {
  try {
    if (!changesSummary) return;

    // Get card with board information
    const card = await cardRepo.getWithListAndMembersByPublicId(db, cardPublicId);
    if (!card?.list.board) return;

    // Get remaining active members
    const memberPublicIds = card.members
      .filter((m) => m.deletedAt === null)
      .map((m) => m.publicId);

    if (memberPublicIds.length === 0) return;

    const board = card.list.board;
    const boardName = board.name;
    const cardTitle = card.title;

    const workspace = await workspaceRepo.getByPublicId(
      db,
      board.workspace.publicId,
    );
    if (!workspace?.id) return;
    const workspaceId = workspace.id;

    // Get updater information
    const updater = await userRepo.getById(db, updaterUserId);
    if (!updater) return;
    const updaterName = updater.name ?? updater.email;

    // Get members with full details
    const membersWithDetails = await memberRepo.getByPublicIdsWithUsers(
      db,
      memberPublicIds,
      workspaceId,
    );

    // Filter out the updater
    const membersToNotify = membersWithDetails.filter(
      (member) => member.user?.id !== updaterUserId,
    );

    if (membersToNotify.length === 0) return;

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");
    const cardUrl = `${baseUrl}/cards/${cardPublicId}`;

    await Promise.all(
      membersToNotify.map(async (member) => {
        const userId = member.user?.id;
        const email = member.user?.email ?? member.email;

        // Skip pending members (no userId) - they can be added but won't receive emails
        if (!userId || !email) return;

        try {
          await sendEmail(
            email,
            `O cartão ${cardTitle} foi atualizado`,
            "CARD_UPDATED",
            {
              updaterName,
              boardName,
              cardTitle,
              cardUrl,
              changesSummary,
            },
          );
        } catch (error) {
          console.error("Failed to send card updated email:", {
            email,
            cardPublicId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  } catch (error) {
    console.error("Error sending card updated emails:", {
      cardPublicId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Sends notification emails to all current members when a new comment is added
 * Excludes the commenter and any members who were explicitly mentioned
 */
export async function sendNewCommentEmails({
  db,
  cardPublicId,
  commenterUserId,
  commentHtml,
}: {
  db: dbClient;
  cardPublicId: string;
  commenterUserId: string;
  commentHtml: string;
}) {
  try {
    const mentionPublicIds = parseMentionsFromHTML(commentHtml);

    const card = await cardRepo.getWithListAndMembersByPublicId(db, cardPublicId);
    if (!card?.list.board) return;

    const activeMemberPublicIds = card.members
      .filter((m) => m.deletedAt === null)
      .map((m) => m.publicId);

    const memberPublicIdsToNotify = activeMemberPublicIds.filter(
      (publicId) => !mentionPublicIds.includes(publicId)
    );

    if (memberPublicIdsToNotify.length === 0) return;

    const board = card.list.board;
    const boardName = board.name;
    const cardTitle = card.title;

    const workspace = await workspaceRepo.getByPublicId(
      db,
      board.workspace.publicId,
    );
    if (!workspace?.id) return;
    const workspaceId = workspace.id;

    const commenter = await userRepo.getById(db, commenterUserId);
    if (!commenter) return;
    const commenterName = commenter.name ?? commenter.email;

    const membersWithDetails = await memberRepo.getByPublicIdsWithUsers(
      db,
      memberPublicIdsToNotify,
      workspaceId,
    );

    const membersToNotify = membersWithDetails.filter(
      (member) => member.user?.id !== commenterUserId,
    );

    if (membersToNotify.length === 0) return;

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");
    const cardUrl = `${baseUrl}/cards/${cardPublicId}`;

    await Promise.all(
      membersToNotify.map(async (member) => {
        const userId = member.user?.id;
        const email = member.user?.email ?? member.email;

        if (!userId || !email) return;

        try {
          await sendEmail(
            email,
            `${commenterName} adicionou um novo comentário no cartão ${cardTitle}`,
            "NEW_COMMENT",
            {
              commenterName,
              boardName,
              cardTitle,
              cardUrl,
            },
          );
        } catch (error) {
          console.error("Failed to send new comment email:", {
            email,
            cardPublicId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  } catch (error) {
    console.error("Error sending new comment emails:", {
      cardPublicId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

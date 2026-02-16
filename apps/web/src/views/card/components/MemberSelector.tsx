import { useRouter } from "next/router";
import { t } from "@lingui/core/macro";
import { HiMiniPlus } from "react-icons/hi2";

import Avatar from "~/components/Avatar";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface MemberSelectorProps {
  cardPublicId: string;
  members: {
    key: string;
    value: string;
    selected: boolean;
    leftIcon: React.ReactNode;
    imageUrl: string | undefined;
  }[];
  isLoading: boolean;
  disabled?: boolean;
}

export default function MemberSelector({
  cardPublicId,
  members,
  isLoading,
  disabled = false,
}: MemberSelectorProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const { openModal } = useModal();
  const { showPopup } = usePopup();

  const addOrRemoveMember = api.card.addOrRemoveMember.useMutation({
    onMutate: async ({ cardPublicId, workspaceMemberPublicId }) => {
      await utils.card.byId.cancel({ cardPublicId });
      const previousCard = utils.card.byId.getData({ cardPublicId });

      if (previousCard) {
        utils.card.byId.setData({ cardPublicId }, (old) => {
          if (!old) return old;

          const isMember = old.members.some(
            (m) => m.publicId === workspaceMemberPublicId,
          );

          let newMembers = [...old.members];

          if (isMember) {
            newMembers = newMembers.filter(
              (m) => m.publicId !== workspaceMemberPublicId,
            );
          } else {
            // Find member in workspace members to add locally
            const workspaceMember = old.list.board.workspace.members.find(
              (m) => m.publicId === workspaceMemberPublicId,
            );
            if (workspaceMember) {
              newMembers.push(workspaceMember);
            }
          }

          return {
            ...old,
            members: newMembers,
          };
        });
      }

      return { previousCard };
    },
    onError: (error, { cardPublicId }, context) => {
      if (context?.previousCard) {
        utils.card.byId.setData({ cardPublicId }, context.previousCard);
      }
      showPopup({
        header: t`Unable to update members`,
        message:
          error.message ||
          t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
    },
  });

  const selectedMembers = members.filter((member) => member.selected);

  const handleInviteMember = async () => {
    await router.push(`/members`);
    openModal("INVITE_MEMBER");
  };

  return (
    <>
      {isLoading ? (
        <div className="flex w-full">
          <div className="h-full w-[125px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
        </div>
      ) : (
        <CheckboxDropdown
          items={members}
          handleSelect={(_, member) => {
            // Defer mutation to avoid race condition with Menu closing when permissions change
            setTimeout(() => {
              addOrRemoveMember.mutate({
                cardPublicId,
                workspaceMemberPublicId: member.key,
              });
            }, 0);
          }}
          handleCreate={disabled ? undefined : handleInviteMember}
          createNewItemLabel={t`Invite member`}
          disabled={disabled}
          asChild
        >
          <div className={`flex h-full w-full items-center rounded-[5px] border-[1px] border-light-50 py-1 pl-2 text-left text-xs text-neutral-900 dark:border-dark-50 dark:text-dark-1000 ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-light-300 hover:bg-light-200 dark:hover:border-dark-200 dark:hover:bg-dark-100"}`}>
            {selectedMembers.length ? (
              <div className="isolate flex justify-end -space-x-1 overflow-hidden">
                {selectedMembers.map(({ value, imageUrl }) => (
                  <Avatar
                    key={value}
                    size="sm"
                    name={value}
                    imageUrl={imageUrl}
                    email={value}
                  />
                ))}
              </div>
            ) : (
              <>
                <HiMiniPlus size={22} className="pr-2" />
                {t`Add member`}
              </>
            )}
          </div>
        </CheckboxDropdown>
      )}
    </>
  );
}

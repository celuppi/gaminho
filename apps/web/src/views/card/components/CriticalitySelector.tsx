import { t } from "@lingui/core/macro";
import { useState } from "react";

import CheckboxDropdown from "~/components/CheckboxDropdown";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface CriticalitySelectorProps {
  cardPublicId: string;
  criticality: "Urgente" | "Importante" | "Média" | "Baixa" | undefined | null;
  isLoading?: boolean;
  disabled?: boolean;
}

export function CriticalitySelector({
  cardPublicId,
  criticality,
  isLoading = false,
  disabled = false,
}: CriticalitySelectorProps) {
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const [isOpen, setIsOpen] = useState(false);

  const updateCriticality = api.card.update.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();

      const previousCard = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (oldCard) => {
        if (!oldCard) return oldCard;

        return {
          ...oldCard,
          criticality:
            update.criticality !== undefined
              ? (update.criticality as
                  | "Urgente"
                  | "Importante"
                  | "Média"
                  | "Baixa")
              : oldCard.criticality,
        };
      });

      return { previousCard };
    },
    onError: (_error, _update, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      showPopup({
        header: t`Unable to update criticality`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
      await utils.board.byId.invalidate();
    },
  });

  const handleSelect = (key: string) => {
    updateCriticality.mutate({
      cardPublicId,
      criticality: key as "Urgente" | "Importante" | "Média" | "Baixa",
    });
    setIsOpen(false);
  };

  const currentCriticality = criticality ?? "Média";

  return (
    <div className="relative flex w-full items-center text-left">
      <div className="w-full">
        <CheckboxDropdown
          disabled={isLoading || disabled}
          items={[
            {
              key: "Urgente",
              value: "Urgente",
              selected: currentCriticality === "Urgente",
            },
            {
              key: "Importante",
              value: "Importante",
              selected: currentCriticality === "Importante",
            },
            {
              key: "Média",
              value: "Média",
              selected: currentCriticality === "Média",
            },
            {
              key: "Baixa",
              value: "Baixa",
              selected: currentCriticality === "Baixa",
            },
          ]}
          handleSelect={(_groupKey, item) => handleSelect(item.key)}
        >
          <div
            className={`flex h-full w-full items-center rounded-[5px] border-[1px] border-light-50 py-1 pl-2 text-left text-xs text-neutral-900 dark:border-dark-50 dark:text-dark-1000 ${
              disabled
                ? "cursor-not-allowed opacity-60"
                : "hover:border-light-300 hover:bg-light-200 dark:hover:border-dark-200 dark:hover:bg-dark-100"
            }`}
          >
            <span className="font-semibold">{currentCriticality}</span>
          </div>
        </CheckboxDropdown>
      </div>
    </div>
  );
}

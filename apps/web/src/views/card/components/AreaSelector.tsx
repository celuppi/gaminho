import { t } from "@lingui/core/macro";
import { HiMiniPlus } from "react-icons/hi2";

import Badge from "~/components/Badge";
import CheckboxDropdown from "~/components/CheckboxDropdown";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { invalidateCard } from "~/utils/cardInvalidation";

interface AreaSelectorProps {
  cardPublicId: string;
  areas: {
    key: string;
    value: string;
    selected: boolean;
    leftIcon: React.ReactNode;
  }[];
  isLoading: boolean;
  disabled?: boolean;
}

export default function AreaSelector({
  cardPublicId,
  areas,
  isLoading,
  disabled = false,
}: AreaSelectorProps) {
  const utils = api.useUtils();
  const { openModal } = useModal();
  const { showPopup } = usePopup();

  const updateCard = api.card.update.useMutation({
    onMutate: async (update) => {
      await utils.card.byId.cancel();

      const previousCard = utils.card.byId.getData({ cardPublicId });

      utils.card.byId.setData({ cardPublicId }, (oldCard) => {
        if (!oldCard) return oldCard;

        // Optimistic update
        // We need to find the area object from the areas prop to update the card's area locally
        // note: areas prop comes from parent, which derives it from board data.
        // But here inside setData we only have oldCard.
        // We can't easily get the area name/colour without looking it up.
        // Use placeholder or try to find it in previous props?
        // Actually, we can rely on standard invalidation or just partial update if we had the area info.
        // For now, let's skip complex optimistic update for area details and just rely on invalidation
        // OR we can try to find the area from the 'areas' prop passed to this component!
        
        let newArea = null;
        if (update.areaPublicId) {
             const areaInfo = areas.find(a => a.key === update.areaPublicId);
             if (areaInfo) {
                 newArea = {
                     publicId: areaInfo.key,
                     name: areaInfo.value,
                     colourCode: typeof areaInfo.leftIcon === 'object' && areaInfo.leftIcon && 'props' in areaInfo.leftIcon ? (areaInfo.leftIcon as any).props.className : undefined // Hacky, better to rely on server response or simpler optimistic update
                 };
             }
        }

        return {
          ...oldCard,
          area: newArea,
        };
      });

      return { previousCard };
    },
    onError: (_error, _newList, context) => {
      utils.card.byId.setData({ cardPublicId }, context?.previousCard);
      showPopup({
        header: t`Unable to update area`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSettled: async () => {
      await invalidateCard(utils, cardPublicId);
    },
  });

  const selectedAreas = areas.filter((area) => area.selected);

  return (
    <>
      {isLoading ? (
        <div className="flex w-full">
          <div className="h-full w-[175px] animate-pulse rounded-[5px] bg-light-300 dark:bg-dark-300" />
        </div>
      ) : (
        <CheckboxDropdown
          items={areas}
          handleSelect={(_, area) => {
            const isSelected = area.selected;
            updateCard.mutate({ 
                cardPublicId, 
                areaPublicId: isSelected ? null : area.key 
            });
          }}
          handleEdit={disabled ? undefined : (areaPublicId) => openModal("EDIT_AREA", areaPublicId)}
          handleCreate={disabled ? undefined : () => openModal("NEW_AREA")}
          createNewItemLabel={t`Create new area`}
          disabled={disabled}
          asChild
        >
          {selectedAreas.length ? (
            <div className="flex flex-wrap gap-x-0.5">
              {selectedAreas.map((area) => (
                <Badge
                  key={area.key}
                  value={area.value}
                  iconLeft={area.leftIcon}
                />
              ))}
            </div>
          ) : (
            <div className={`flex h-full w-full items-center rounded-[5px] border-[1px] border-light-50 pl-2 text-left text-sm text-neutral-900 dark:border-dark-50 dark:text-dark-1000 ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-light-300 hover:bg-light-200 dark:hover:border-dark-200 dark:hover:bg-dark-100"}`}>
              <HiMiniPlus size={22} className="pr-2" />
              {t`Add area`}
            </div>
          )}
        </CheckboxDropdown>
      )}
    </>
  );
}

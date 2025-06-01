"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { setLastViewedBase } from "~/utils/lastViewedBase";
import { BaseContextMenu } from "./BaseContextMenu";

export function BaseCard({
  baseId,
  baseName,
  baseColor,
}: {
  baseId: string;
  baseName: string;
  baseColor: string;
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
  } | null>(null);

  const deleteMutation = api.base.delete.useMutation({
    async onMutate({ id }) {
      await utils.base.getAllByLastUpdated.cancel();

      const previousBases = utils.base.getAllByLastUpdated.getData();

      utils.base.getAllByLastUpdated.setData(undefined, (old) => {
        if (!old) return [];
        return old.filter((base) => base.id !== id);
      });

      return { previousBases };
    },
    onError(err, _, context) {
      if (context?.previousBases) {
        utils.base.getAllByLastUpdated.setData(
          undefined,
          context.previousBases,
        );
      }
      toast.error("Failed to delete base. Please try again.");
    },
    onSuccess() {
      toast.success(`"${baseName}" base deleted successfully`);
    },
    onSettled() {
      void utils.base.getAllByLastUpdated.invalidate();
    },
  });

  const updateBaseNameMutation = api.base.updateName.useMutation({
    onMutate: async ({ id, name }) => {
      await utils.base.getAllByLastUpdated.cancel();

      const previousBases = utils.base.getAllByLastUpdated.getData();

      utils.base.getAllByLastUpdated.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((base) => (base.id === id ? { ...base, name } : base));
      });

      return { previousBases };
    },
    onSuccess: () => {
      toast.success("Base renamed successfully");
    },
    onError: (error, variables, context) => {
      if (context?.previousBases) {
        utils.base.getAllByLastUpdated.setData(
          undefined,
          context.previousBases,
        );
      }
      toast.error(`Failed to rename base: ${error.message}`);
    },
    onSettled: () => {
      void utils.base.getAllByLastUpdated.invalidate();
    },
  });

  const handleClick = () => {
    setLastViewedBase(baseId);
    router.push(`/${baseId}?color=${encodeURIComponent(baseColor)}`);
  };

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleUpdateBaseName = useCallback(
    async (baseName: string) => {
      await updateBaseNameMutation.mutateAsync({
        id: baseId,
        name: baseName,
      });
    },
    [baseId, updateBaseNameMutation],
  );

  const handleDeleteBase = useCallback(
    async (baseId: string) => {
      if (deleteMutation.isPending) return;

      try {
        await deleteMutation.mutateAsync({ id: baseId });
      } catch (error) {
        console.error("Error deleting base:", error);
      }
    },
    [deleteMutation],
  );

  return (
    <>
      <div
        className="group relative flex h-[92px] max-w-[572px] min-w-[286px] cursor-pointer flex-col overflow-hidden rounded-[6px] bg-white shadow-[0px_0px_1px_rgba(0,0,0,0.32),0px_0px_2px_rgba(0,0,0,0.08),0px_1px_3px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0px_0px_1px_rgba(0,0,0,0.32),0px_0px_3px_rgba(0,0,0,0.11),0px_1px_4px_rgba(0,0,0,0.12)]"
        onClick={handleClick}
        onContextMenu={handleRightClick}
      >
        <div className="flex items-center justify-between">
          <div
            className={`m-[18px] flex h-14 w-14 items-center justify-center rounded-[12px] p-[18px] text-[22px] text-white`}
            style={{ backgroundColor: baseColor }}
          >
            {baseName.length > 1
              ? baseName.charAt(0).toUpperCase() +
                baseName.charAt(1).toLowerCase()
              : baseName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-medium">{baseName}</h3>
            <p className="text-[11px] text-zinc-500">Base</p>
          </div>
        </div>
      </div>

      {contextMenu && (
        <BaseContextMenu
          baseId={baseId}
          initialName={baseName}
          position={contextMenu.position}
          onUpdateAction={handleUpdateBaseName}
          onDeleteAction={handleDeleteBase}
          onCloseAction={handleCloseContextMenu}
        />
      )}
    </>
  );
}

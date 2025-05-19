"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "~/trpc/react"; // Make sure this import is correct for your setup

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

  // Setup delete mutation with optimistic updates
  const deleteMutation = api.base.delete.useMutation({
    async onMutate({ id }) {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await utils.base.getAllByLastUpdated.cancel();

      // Snapshot the previous value
      const previousBases = utils.base.getAllByLastUpdated.getData();

      // Optimistically remove the base from the list
      utils.base.getAllByLastUpdated.setData(undefined, (old) => {
        if (!old) return [];
        return old.filter((base) => base.id !== id);
      });

      // Return context with the snapshotted value
      return { previousBases };
    },
    onError(err, _, context) {
      // If the mutation fails, use the context returned from onMutate to roll back
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
      // Sync with server once mutation has settled
      void utils.base.getAllByLastUpdated.invalidate();
    },
  });

  const handleClick = () => {
    router.push(`/${baseId}?color=${encodeURIComponent(baseColor)}`);
  };

  const handleDelete = async () => {
    if (deleteMutation.isPending) return;

    try {
      await deleteMutation.mutateAsync({ id: baseId });
    } catch (error) {
      // Error handling is done in onError callback
      console.error("Error deleting base:", error);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="group relative flex h-[92px] max-w-[572px] min-w-[286px] cursor-pointer flex-col overflow-hidden rounded-[6px] bg-white shadow-[0px_0px_1px_rgba(0,0,0,0.32),0px_0px_2px_rgba(0,0,0,0.08),0px_1px_3px_rgba(0,0,0,0.08)] transition-all hover:shadow-[0px_0px_1px_rgba(0,0,0,0.32),0px_0px_3px_rgba(0,0,0,0.11),0px_1px_4px_rgba(0,0,0,0.12)]"
          onClick={handleClick}
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
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          className="text-red-500"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? "Deleting..." : "Delete base"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

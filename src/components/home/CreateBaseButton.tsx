"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { getColorFromBaseId } from "~/lib/utils";
import { setLastViewedBase } from "~/utils/lastViewedBase";

export function CreateBaseButton() {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();

  // Use tRPC mutation directly instead of server action
  const createBaseMutation = api.base.create.useMutation({
    onSuccess: () => {
      // Invalidate and refetch base list
      void utils.base.getAllByLastUpdated.invalidate();
    },
    onError: (error) => {
      console.error("Error creating base:", error);
      toast.error("Failed to create base. Please try again.");
    },
  });

  const handleCreateBase = async () => {
    if (isCreating) return;

    try {
      setIsCreating(true);

      // Generate base ID and color (same logic as deleted action)
      const baseId = crypto.randomUUID();
      const color = getColorFromBaseId(baseId);

      if (!color) {
        toast.error("Failed to generate base color. Please try again.");
        return;
      }

      // Create the base using tRPC mutation
      await createBaseMutation.mutateAsync({
        id: baseId,
        color,
      });

      // Set as last viewed base immediately
      setLastViewedBase(baseId);

      // Navigate to the new base
      router.push(`/${baseId}?color=${encodeURIComponent(color)}`);

      toast.success("Base created successfully!");
    } catch (error) {
      console.error("Error creating base:", error);
      toast.error("Failed to create base. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <Button
        className="h-8 w-full cursor-pointer gap-2 bg-[rgb(45,127,249)] text-[13px] font-semibold hover:bg-[rgb(41,122,241)]"
        onClick={handleCreateBase}
        disabled={isCreating}
        title="Click to create a base"
      >
        {isCreating ? "Creating..." : "Create a base"}
      </Button>
    </div>
  );
}

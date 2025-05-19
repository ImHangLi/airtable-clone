"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { createBase } from "~/actions/base.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "~/trpc/react";

export function CreateBaseButton() {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const utils = api.useUtils();
  const handleCreateBase = async () => {
    if (isCreating) return;

    try {
      setIsCreating(true);
      const result = await createBase();

      if (!result) {
        toast.error("Failed to create base. Please try again.");
        return;
      }

      // Navigate to the new base
      router.push(
        `/${result.baseId}?color=${encodeURIComponent(result.color)}`,
      );

      void utils.base.getAllByLastUpdated.invalidate();
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
      >
        {isCreating ? "Creating..." : "Create a base"}
      </Button>
    </div>
  );
}

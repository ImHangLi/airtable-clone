"use client";

import { UserButton } from "@clerk/nextjs";
import { AirtableLogo } from "../Icons";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface BaseTopNavProps {
  baseName: string | undefined;
  baseColor: string | undefined;
  baseId?: string;
}

export default function BaseTopNav({
  baseName,
  baseColor,
  baseId,
}: BaseTopNavProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [inputValue, setInputValue] = useState(baseName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const utils = api.useUtils();

  const updateBaseNameMutation = api.base.updateName.useMutation({
    onMutate: async ({ id, name }) => {
      // Cancel any outgoing queries to prevent race conditions
      await utils.base.getNameAndColorById.cancel({ id });
      await utils.base.getAllByLastUpdated.cancel();

      // Get previous data for rollback
      const previousBaseData = utils.base.getNameAndColorById.getData({ id });
      const previousBasesData = utils.base.getAllByLastUpdated.getData();

      // Optimistically update the specific base query
      utils.base.getNameAndColorById.setData({ id }, (old) => {
        if (!old) return old;
        return { ...old, name };
      });

      // Optimistically update the base list query
      utils.base.getAllByLastUpdated.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((base) => (base.id === id ? { ...base, name } : base));
      });

      return { previousBaseData, previousBasesData };
    },
    onSuccess: () => {
      toast.success("Base renamed successfully");
    },
    onError: (error, variables, context) => {
      // Rollback both caches on error
      if (context?.previousBaseData) {
        utils.base.getNameAndColorById.setData(
          { id: variables.id },
          context.previousBaseData,
        );
      }
      if (context?.previousBasesData) {
        utils.base.getAllByLastUpdated.setData(
          undefined,
          context.previousBasesData,
        );
      }
      toast.error(`Failed to rename base: ${error.message}`);
      setInputValue(baseName ?? "");
    },
    onSettled: (data, error, variables) => {
      // Invalidate both queries to ensure they're fresh
      void utils.base.getNameAndColorById.invalidate({ id: variables.id });
      void utils.base.getAllByLastUpdated.invalidate();
    },
  });

  const handleStartRename = useCallback(() => {
    if (!baseId) return;
    setInputValue(baseName ?? "");
    setIsRenaming(true);
  }, [baseName, baseId]);

  const handleSaveRename = useCallback(() => {
    if (!baseId || !inputValue.trim()) {
      setInputValue(baseName ?? "");
      setIsRenaming(false);
      return;
    }

    if (inputValue.trim() === baseName) {
      setIsRenaming(false);
      return;
    }

    updateBaseNameMutation.mutate({
      id: baseId,
      name: inputValue.trim(),
    });

    setIsRenaming(false);
  }, [baseId, inputValue, baseName, updateBaseNameMutation]);

  const handleCancelRename = useCallback(() => {
    setInputValue(baseName ?? "");
    setIsRenaming(false);
  }, [baseName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelRename();
      }
    },
    [handleSaveRename, handleCancelRename],
  );

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        formRef.current &&
        !formRef.current.contains(event.target as Node) &&
        isRenaming
      ) {
        handleSaveRename();
      }
    };

    if (isRenaming) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRenaming, handleSaveRename]);

  return (
    <header
      className="flex min-h-[56px] items-center px-4 pl-5"
      style={{ backgroundColor: baseColor }}
    >
      <div className="flex h-12 flex-1 items-center justify-between">
        <div className="flex items-center">
          <div className="flex min-w-[60px] items-center gap-3">
            <AirtableLogo />
            {isRenaming ? (
              <div ref={formRef} className="relative">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="rounded border border-white/30 bg-white/10 px-2 py-1 text-[17px] leading-6 font-[675] tracking-[-0.16px] text-white placeholder-white/60 focus:border-white/50 focus:bg-white/20 focus:outline-none"
                  placeholder="Base name"
                  disabled={updateBaseNameMutation.isPending}
                />
              </div>
            ) : (
              <div
                className="flex cursor-pointer items-center rounded px-2 py-1 transition-colors hover:bg-white/10"
                onClick={handleStartRename}
              >
                <span className="text-[17px] leading-6 font-[675] tracking-[-0.16px] text-white">
                  {baseName}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 text-white" />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          <div className="ml-2 flex items-center">
            <UserButton />
          </div>
        </div>
      </div>
    </header>
  );
}

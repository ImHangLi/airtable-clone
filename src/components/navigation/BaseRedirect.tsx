"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { getLastViewedTable } from "~/utils/lastViewedTable";
import { getLastViewedView } from "~/utils/lastViewedView";
import { setLastViewedBase } from "~/utils/lastViewedBase";

interface BaseRedirectProps {
  baseId: string;
}

export function BaseRedirect({ baseId }: BaseRedirectProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const createDefaultMutation = api.table.createDefault.useMutation();
  const hasNavigated = useRef(false);
  const currentBaseId = useRef(baseId);

  const navigateToTableView = (tableId: string, viewId: string) => {
    router.push(`/${baseId}/${tableId}/${viewId}`);
  };

  const tryNavigate = (tableId?: string, viewId?: string): boolean => {
    if (tableId && viewId) {
      navigateToTableView(tableId, viewId);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (currentBaseId.current !== baseId) {
      hasNavigated.current = false;
      currentBaseId.current = baseId;
    }
  }, [baseId]);

  useEffect(() => {
    const navigateToLastViewed = async () => {
      if (hasNavigated.current) return;

      try {
        hasNavigated.current = true;
        setLastViewedBase(baseId);

        // Step 1: Try last viewed table + view
        const lastViewedTableId = getLastViewedTable(baseId);
        if (lastViewedTableId) {
          const lastViewedViewId = getLastViewedView(lastViewedTableId);
          if (tryNavigate(lastViewedTableId, lastViewedViewId ?? undefined))
            return;

          // Step 2: Try last viewed table + default view
          try {
            const tableDefaultView =
              await utils.table.getTableDefaultView.fetch({
                tableId: lastViewedTableId,
              });
            if (tryNavigate(lastViewedTableId, tableDefaultView?.view?.id))
              return;
          } catch (error) {
            console.warn(
              "Failed to get default view for last viewed table:",
              error,
            );
          }
        }

        // Step 3: Try any existing table/view
        const latestTableView = await utils.table.getLatest.fetch({ baseId });
        if (tryNavigate(latestTableView?.table?.id, latestTableView?.view?.id))
          return;

        // Step 4: Create default table/view
        const defaultTable = await createDefaultMutation.mutateAsync({
          baseId,
          tableName: "Table 1",
          viewName: "Grid view",
        });
        if (tryNavigate(defaultTable?.table?.id, defaultTable?.view?.id))
          return;

        // Final fallback
        router.push("/");
      } catch (error) {
        console.error("Error during base navigation:", error);
        hasNavigated.current = false; // Allow retry on error
        router.push("/");
      }
    };

    void navigateToLastViewed();
  }, [baseId]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
        <span className="text-gray-600">Loading...</span>
      </div>
    </div>
  );
}

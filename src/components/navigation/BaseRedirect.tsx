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

  // Prevent multiple runs
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Only run once per baseId
    if (hasNavigated.current) return;

    const navigateToLastViewed = async () => {
      try {
        hasNavigated.current = true;

        // Set this base as the last viewed base
        setLastViewedBase(baseId);

        // Step 1: Check localStorage for last viewed table
        const lastViewedTableId = getLastViewedTable(baseId);

        if (lastViewedTableId) {
          // Step 2: Check for last viewed view
          const lastViewedViewId = getLastViewedView(lastViewedTableId);

          if (lastViewedViewId) {
            // Found both - navigate directly
            router.push(`/${baseId}/${lastViewedTableId}/${lastViewedViewId}`);
            return;
          }

          // Step 3: Get default view for the table
          try {
            const tableDefaultView =
              await utils.table.getTableDefaultView.fetch({
                tableId: lastViewedTableId,
              });

            if (tableDefaultView?.view?.id) {
              router.push(
                `/${baseId}/${lastViewedTableId}/${tableDefaultView.view.id}`,
              );
              return;
            }
          } catch (error) {
            console.warn(
              "Failed to get default view for last viewed table:",
              error,
            );
            // Continue to next step
          }
        }

        // Step 4: Query database for any existing table/view
        const latestTableView = await utils.table.getLatest.fetch({ baseId });

        if (latestTableView?.table?.id && latestTableView?.view?.id) {
          router.push(
            `/${baseId}/${latestTableView.table.id}/${latestTableView.view.id}`,
          );
          return;
        }

        // Step 5: Create default table/view only if nothing exists
        const defaultTable = await createDefaultMutation.mutateAsync({
          baseId,
          tableName: "Table 1",
          viewName: "Grid View",
        });

        if (defaultTable?.table?.id && defaultTable?.view?.id) {
          router.push(
            `/${baseId}/${defaultTable.table.id}/${defaultTable.view.id}`,
          );
          return;
        }

        // Fallback to home
        router.push("/");
      } catch (error) {
        console.error("Error during base navigation:", error);
        hasNavigated.current = false; // Reset on error so user can retry
        router.push("/");
      }
    };

    void navigateToLastViewed();
  }, [baseId]); // Only depend on baseId

  // Reset navigation flag when baseId changes
  useEffect(() => {
    hasNavigated.current = false;
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

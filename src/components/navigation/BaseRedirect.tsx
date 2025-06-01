"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { getLastViewedTable } from "~/utils/lastViewedTable";
import { getLastViewedView } from "~/utils/lastViewedView";

interface BaseRedirectProps {
  baseId: string;
}

export function BaseRedirect({ baseId }: BaseRedirectProps) {
  const router = useRouter();
  const utils = api.useUtils();
  const createDefaultMutation = api.table.createDefault.useMutation();

  useEffect(() => {
    const navigateToLastViewed = async () => {
      try {
        // First, check localStorage for the last viewed table for this base
        const lastViewedTableId = getLastViewedTable(baseId);

        if (lastViewedTableId) {
          // If we have a last viewed table, check for the last viewed view
          const lastViewedViewId = getLastViewedView(lastViewedTableId);

          if (lastViewedViewId) {
            // We have both table and view - navigate directly
            console.log(
              `Navigating to last viewed: /${baseId}/${lastViewedTableId}/${lastViewedViewId}`,
            );
            router.push(`/${baseId}/${lastViewedTableId}/${lastViewedViewId}`);
            return;
          } else {
            // We have table but no view - get the default view for the table
            try {
              const tableDefaultView =
                await utils.table.getTableDefaultView.fetch({
                  tableId: lastViewedTableId,
                });

              if (tableDefaultView?.view?.id) {
                console.log(
                  `Navigating to last viewed table with default view: /${baseId}/${lastViewedTableId}/${tableDefaultView.view.id}`,
                );
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
              // Fall through to database query
            }
          }
        }

        // No localStorage data or failed to use it - fall back to database query
        console.log(
          "No localStorage data found, querying database for latest table/view",
        );
        const latestTableView = await utils.table.getLatest.fetch({ baseId });

        if (latestTableView?.table?.id && latestTableView?.view?.id) {
          console.log(
            `Navigating to database latest: /${baseId}/${latestTableView.table.id}/${latestTableView.view.id}`,
          );
          router.push(
            `/${baseId}/${latestTableView.table.id}/${latestTableView.view.id}`,
          );
          return;
        }

        // No existing table/view found - create default ones
        console.log(
          "No existing tables found, creating default table and view",
        );
        const defaultTable = await createDefaultMutation.mutateAsync({
          baseId,
          tableName: "Table 1",
          viewName: "Grid View",
        });

        if (defaultTable?.table?.id && defaultTable?.view?.id) {
          console.log(
            `Navigating to new default: /${baseId}/${defaultTable.table.id}/${defaultTable.view.id}`,
          );
          router.push(
            `/${baseId}/${defaultTable.table.id}/${defaultTable.view.id}`,
          );
          return;
        }

        // If we reach here, something went wrong
        console.error("Failed to create or find any table/view for base");
        router.push("/");
      } catch (error) {
        console.error("Error during base navigation:", error);
        router.push("/");
      }
    };

    void navigateToLastViewed();
  }, [baseId, router, utils, createDefaultMutation]);

  // Show a simple loading indicator while we determine where to navigate
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
        <span className="text-gray-600">Loading...</span>
      </div>
    </div>
  );
}

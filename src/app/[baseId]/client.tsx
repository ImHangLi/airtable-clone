"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef } from "react";
import {
  getLatestTableView,
  createDefaultTableView,
} from "~/actions/table.view.actions";

interface BasePageProps {
  params: Promise<{ baseId: string }>;
}

/**
 * BasePage Component
 *
 * This component handles the initial routing logic for a base.
 * It either redirects to an existing table/view or creates a default one.
 *
 * Flow:
 * 1. Check if there's an existing table/view for this base
 * 2. If yes: redirect to that table/view
 * 3. If no: create a default table/view and redirect to it
 * 4. On any error: redirect to home page
 */
export default function BasePage({ params }: BasePageProps) {
  const router = useRouter();
  const { baseId } = use(params);
  const hasHandled = useRef(false);

  useEffect(() => {
    // Prevent multiple executions of the initialization logic
    if (hasHandled.current) return;
    hasHandled.current = true;

    /**
     * Initialize the base by either finding existing table/view
     * or creating default ones
     */
    async function initializeBase() {
      try {
        // Attempt to get the most recent table and view for this base
        const latestTableView = await getLatestTableView(baseId);

        if (latestTableView?.table.id && latestTableView?.view.id) {
          // Found existing table and view - redirect immediately
          router.replace(
            `/${baseId}/${latestTableView.table.id}/${latestTableView.view.id}`,
            { scroll: false },
          );
        } else {
          // No existing table/view found - create default ones
          const defaultTable = await createDefaultTableView(baseId);

          if (defaultTable?.table && defaultTable?.view) {
            // Successfully created default table/view - redirect
            router.replace(
              `/${baseId}/${defaultTable.table.id}/${defaultTable.view.id}`,
            );
          } else {
            // Failed to create default table/view
            console.error(
              "Failed to create default table and view for base:",
              baseId,
            );
            router.push("/");
          }
        }
      } catch (error) {
        // Log error and redirect to home on any failure
        console.error("Error initializing base:", error);
        router.push("/");
      }
    }

    void initializeBase();
  }, [baseId, router]);

  // Render nothing while handling the redirect logic
  return null;
}

"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef } from "react";
import {
  getLatestTableView,
  createDefaultTableView,
} from "~/actions/table.view.actions";

export default function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const router = useRouter();
  const { baseId } = use(params);
  const hasHandled = useRef(false);

  useEffect(() => {
    // Only run this effect once per mount
    if (hasHandled.current) return;
    hasHandled.current = true;

    async function initializeBase() {
      try {
        // Check if there's an existing table/view
        const latestData = await getLatestTableView(baseId);

        if (latestData?.table?.id && latestData?.view?.id) {
          // Table/view exists, redirect immediately
          router.replace(
            `/${baseId}/${latestData.table.id}/${latestData.view.id}`,
            { scroll: false },
          );
        } else {
          // No table/view exists, create default
          const result = await createDefaultTableView(baseId);

          if (result?.table?.id && result?.view?.id) {
            router.replace(`/${baseId}/${result.table.id}/${result.view.id}`);
          } else {
            // Something went wrong with table creation
            console.error("Could not create table and view");
            router.push("/");
          }
        }
      } catch (error) {
        console.error("Error initializing base:", error);
        router.push("/");
      }
    }

    void initializeBase();
  }, [baseId, router]);

  return null;
}

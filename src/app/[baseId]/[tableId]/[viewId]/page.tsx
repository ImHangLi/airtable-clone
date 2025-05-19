"use client";

import { use } from "react";
import BaseTopNav from "~/components/base/BaseTopNav";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export default function TableViewPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { baseId, tableId, viewId } = use(params);
  const { data: baseNameAndColor } = api.base.getNameAndColorById.useQuery({
    id: baseId,
  });

  if (baseNameAndColor?.name === undefined || baseNameAndColor?.color === undefined) {
    toast.error("Base not found");
  }
  return (
    <>
      <BaseTopNav
        baseName={baseNameAndColor?.name}
        baseColor={baseNameAndColor?.color}
      />
      <div className="flex h-screen w-screen flex-col items-center justify-center text-center">
        You are viewing table {tableId} with view {viewId}
      </div>
    </>
  );
}

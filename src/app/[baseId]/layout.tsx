"use client";

import { use } from "react";
import BaseSkeleton from "~/components/base/BaseSkeleton";
import { getColorFromBaseId } from "~/lib/utils";

type BaseLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    baseId: string;
  }>;
};

export default function BaseLayout({
  children,
  params,
}: BaseLayoutProps) {
  // Get the base color from the base id
  const { baseId } = use(params);
  const baseColor = getColorFromBaseId(baseId);

  return (
    <div className="relative h-screen w-full">
      {/* Skeleton is always rendered, even while children are loading */}
      <BaseSkeleton baseColor={baseColor} />
      {/* Overlay the actual content */}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

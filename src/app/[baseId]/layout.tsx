import BaseSkeleton from "~/components/base/BaseSkeleton";
import { type ReactNode } from "react";
import { getColorFromBaseId } from "~/lib/utils";

export default async function BaseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { baseId: string };
}) {
  // Get the base color from the base id
  const baseColor = getColorFromBaseId(params.baseId);

  return (
    <div className="relative h-screen w-full">
      {/* Skeleton is always rendered, even while children are loading */}
      <BaseSkeleton baseColor={baseColor} />
      {/* Overlay the actual content */}
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

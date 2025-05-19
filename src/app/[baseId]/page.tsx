"use server";

import { getColorFromBaseId } from "~/lib/utils";
import BaseSkeleton from "~/components/base/BaseSkeleton";
import BaseRedirect from "./client";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;

  const baseColor = getColorFromBaseId(baseId);

  return(
    <>
      <BaseSkeleton baseColor={baseColor} />
      <BaseRedirect params={params} />
    </>
  );
}

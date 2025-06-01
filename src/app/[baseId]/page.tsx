import { BaseRedirect } from "~/components/navigation/BaseRedirect";
import BaseSkeleton from "~/components/base/BaseSkeleton";
import { getColorFromBaseId } from "~/lib/utils";

interface BasePageProps {
  params: Promise<{ baseId: string }>;
}

export default async function BasePage({ params }: BasePageProps) {
  const { baseId } = await params;
  const baseColor = getColorFromBaseId(baseId);

  return(
    <>
      <BaseSkeleton baseColor={baseColor} />
      <BaseRedirect baseId={baseId} />
    </>
  );
}

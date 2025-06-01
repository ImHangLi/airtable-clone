import { BaseRedirect } from "~/components/navigation/BaseRedirect";

interface BasePageProps {
  params: Promise<{ baseId: string }>;
}

export default async function BasePage({ params }: BasePageProps) {
  const { baseId } = await params;

  return <BaseRedirect baseId={baseId} />;
}

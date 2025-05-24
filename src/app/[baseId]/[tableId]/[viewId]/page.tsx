import TableViewPageClient from "./client";

// Server Component
export default async function Page({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  return <TableViewPageClient params={params} />;
}

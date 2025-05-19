import { api } from "~/trpc/server";
import { HydrateClient } from "~/trpc/server";
import { Suspense } from "react";
import { HomeClientShell } from "./HomeClientShell";

export default async function HomePage() {
  // Fetch bases on the server
  const bases = await api.base.getAllByLastUpdated();

  return (
    <HydrateClient>
      <Suspense fallback={<div className="h-14 w-full bg-white"></div>}>
        <HomeClientShell initialBases={bases} />
      </Suspense>
    </HydrateClient>
  );
}

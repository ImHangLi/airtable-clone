import { api, HydrateClient } from "~/trpc/server";
import { HomeClientComponent } from "~/components/home/HomeClientComponent";

export default async function Home() {
  const bases = await api.base.getAllByLastUpdated();

  return (
    <HydrateClient>
      <HomeClientComponent initialBases={bases} />
    </HydrateClient>
  );
}

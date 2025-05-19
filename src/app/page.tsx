import HomePage from "~/components/home/HomePage";

export default function Home() {
  return <HomePage />;
}

// Set revalidate time to avoid stale data
export const revalidate = 30; // revalidate every 30 seconds

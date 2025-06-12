"use client";

import { useState, useMemo, useEffect } from "react";
import { TopNav } from "~/components/home/TopNav";
import { Sidebar } from "~/components/home/SideBar";
import { BaseCard } from "~/components/home/BaseCard";
import { CreateBaseButton } from "~/components/home/CreateBaseButton";
import { api } from "~/trpc/react";
import { sortBasesByLastViewed } from "~/utils/lastViewedBase";
import type { RouterOutputs } from "~/trpc/react";

interface HomeClientComponentProps {
  initialBases: RouterOutputs["base"]["getAllByLastUpdated"];
}

export function HomeClientComponent({
  initialBases,
}: HomeClientComponentProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Use server-rendered data as initial data, but keep it reactive for updates
  const { data: bases = initialBases } = api.base.getAllByLastUpdated.useQuery(
    undefined,
    {
      // Use initial data to prevent flickering
      initialData: initialBases,
      // Keep the data fresh but don't refetch immediately since we have SSR data
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 5 * 1000,
    },
  );

  // Handle hydration - only sort after client-side hydration to avoid mismatch
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const sortedBases = useMemo(() => {
    // During SSR and before hydration, use original order to prevent hydration mismatch
    if (!isHydrated) {
      return bases;
    }
    // After hydration, use localStorage-based sorting
    return sortBasesByLastViewed(bases);
  }, [bases, isHydrated]);

  return (
    <div className="flex h-screen flex-col">
      <TopNav sidebarOpen={sidebarOpen} setsidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar controlled by sidebarOpen */}
        {!sidebarOpen && (
          <div className="group relative">
            {/* Mini sidebar - always visible when sidebar is closed */}
            <div className="relative z-10 h-full w-[46px] border-r border-gray-200 bg-white py-3 pt-5">
              <Sidebar.Mini />
            </div>
            {/* Full sidebar - appears on hover */}
            <div className="absolute top-0 left-0 z-50 h-full w-[300px] -translate-x-full border-r border-gray-200 bg-white p-3 shadow-lg transition-transform duration-100 ease-in-out group-hover:translate-x-0">
              <Sidebar.Full />
            </div>
          </div>
        )}
        {sidebarOpen && (
          <div className="w-[300px] border-r border-gray-200 bg-white p-3">
            <Sidebar.Full />
          </div>
        )}
        {/* Main content */}
        <div className="flex-1 transition-all duration-300">
          <h1 className="pt-8 pl-12 text-[27px] font-[675]">Home</h1>
          {sortedBases.length > 0 ? (
            <div className="m-8">
              <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(286px,1fr))] gap-4">
                {sortedBases.map((base) => (
                  <BaseCard
                    key={base.id}
                    baseId={base.id}
                    baseName={base.name}
                    baseColor={base.color}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-2 pb-4">
              <h2 className="text-[21px]">Nothing has been shared with you</h2>
              <p className="m-1 mb-6 text-[13px] text-gray-500">
                Bases and interfaces that have been shared with you will appear
                here.
              </p>
              <CreateBaseButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { TopNav } from "./TopNav";
import { Sidebar } from "./SideBar";
import { BaseCard } from "./BaseCard";
import { CreateBaseButton } from "./CreateBaseButton";
import { api } from "~/trpc/react";

export function HomeClientShell({
  initialBases,
}: {
  initialBases: Array<{ id: string; name: string; color: string }>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: bases = initialBases } = api.base.getAllByLastUpdated.useQuery(
    undefined,
    {
      // Keep the data fresh
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );

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
          {bases.length > 0 ? (
            <div className="m-8">
              <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(286px,1fr))] gap-4">
                {bases.map((base) => (
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

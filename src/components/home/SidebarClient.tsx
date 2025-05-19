"use client";

import { Sidebar } from "./SideBar";

export function SidebarClient({ sidebarOpen }: { sidebarOpen: boolean }) {
  return (
    <>
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

      {/* When sidebar is open, show it normally */}
      {sidebarOpen && (
        <div className="w-[300px] border-r border-gray-200 bg-white p-3">
          <Sidebar.Full />
        </div>
      )}
    </>
  );
}

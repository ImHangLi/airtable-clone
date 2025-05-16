"use client";

import { useState } from "react";
import { TopNav } from "./TopNav";
import { Sidebar } from "./SideBar";
import { Button } from "../ui/button";

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleCreateBase = () => {
    console.log("create base");
  };

  return (
    <div className="flex h-screen flex-col">
      <TopNav sidebarOpen={sidebarOpen} setsidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-1 overflow-hidden">
        {/* When sidebar is closed, show the sidebar container with hover effect */}
        {!sidebarOpen && (
          <div className="group relative">
            {/* Mini sidebar - always visible when sidebar is closed */}
            <div className="relative z-10 h-full w-[46px] border-r border-gray-200 bg-white py-3 pt-5">
              <Sidebar.Mini />
            </div>

            {/* Full sidebar - appears on hover */}
            <div className="absolute top-0 left-0 z-50 h-full w-[300px] -translate-x-full border-r border-gray-200 bg-white p-3 shadow-lg transition-transform duration-100 ease-in-out group-hover:translate-x-0">
              <Sidebar.Full handleCreateBase={handleCreateBase} />
            </div>
          </div>
        )}

        {/* When sidebar is open, show it normally */}
        {sidebarOpen && (
          <div className="w-[300px] border-r border-gray-200 bg-white p-3">
            <Sidebar.Full handleCreateBase={handleCreateBase} />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 transition-all duration-300">
          <h1 className="pt-8 pl-12 text-[27px] font-[675]">Home</h1>
          <div className="flex h-full w-full flex-col items-center justify-center p-2 pb-4">
            <h2 className="text-[21px]">Nothing has been shared with you</h2>
            <p className="m-1 text-[13px] text-gray-500">
              Bases and interfaces that have been shared with you will appear
              here.
            </p>
            <Button className="mt-4 h-8 cursor-pointer gap-2 border-1 bg-white text-[13px] text-gray-700 hover:border-2 hover:bg-white">
              Create a base
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

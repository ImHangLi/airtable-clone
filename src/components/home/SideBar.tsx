"use client";

import {
  ChevronRight,
  Users,
  Plus,
  BookOpen,
  ShoppingBag,
  Upload,
  Home,
  Star,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { CreateBaseButton } from "./CreateBaseButton";
import { cn } from "~/lib/utils";
import { useState } from "react";

type OpenSection = "home" | "workspaces" | null;

// Mini sidebar component
function Mini() {
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex flex-col border-b border-gray-200">
        <Button variant="ghost" size="sm" className="mb-2 cursor-pointer p-0">
          <Home className="text-gray-700" />
        </Button>
        <Button variant="ghost" size="sm" className="mb-2 cursor-pointer p-0">
          <Users className="text-gray-700" />
        </Button>
      </div>

      <div className="flex flex-col border-t border-gray-200 pt-2">
        <Button variant="ghost" size="sm" className="mb-1 cursor-pointer p-0">
          <BookOpen className="text-gray-500" />
        </Button>
        <Button variant="ghost" size="sm" className="mb-1 cursor-pointer p-0">
          <ShoppingBag className="text-gray-500" />
        </Button>
        <Button variant="ghost" size="sm" className="mb-1 cursor-pointer p-0">
          <Upload className="text-gray-500" />
        </Button>
      </div>
    </div>
  );
}

// Full sidebar component
function Full() {
  const [openSection, setOpenSection] = useState<OpenSection>("workspaces");

  const toggleSection = (section: OpenSection) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <nav className="flex h-full min-h-[597px] flex-col justify-between">
      <div>
          {/* Navigation Section */}
          <div className="mb-2 flex flex-col">
            <div className="flex items-center gap-2 rounded-sm hover:bg-[rgb(242,244,248)]">
              <button
                className="flex flex-1 items-center px-3 py-2 text-[15px] font-medium text-gray-700 hover:text-gray-900"
                onClick={() => toggleSection("home")}
              >
                Home
              </button>
              <button
                className="m-2 flex h-6 w-6 items-center justify-center rounded p-1 hover:bg-gray-100"
                onClick={() => toggleSection("home")}
              >
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    openSection === "home" && "rotate-90",
                  )}
                />
              </button>
            </div>
            {openSection === "home" && (
              <div className="mt-1 flex items-center space-y-0.5 px-3">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-xs border border-[rgb(0,0,0,0.1)]">
                  <Star width={16} height={16} className="text-[rgb(0,0,0,0.1)]" />
                </div>
                <p className="ml-3 py-1 text-[11px] font-[500] leading-[13.75px] text-[rgb(97,102,112)]">
                  Your starred bases, interfaces, and workspaces will appear
                  here
                </p>
              </div>
            )}
          </div>

          {/* Workspaces Section */}
          <div>
            <div className="flex items-center rounded-sm hover:bg-[rgb(242,244,248)]">
              <button
                className="flex flex-1 items-center justify-between px-3 py-2 text-[15px] font-medium text-gray-700 hover:text-gray-900"
                onClick={() => toggleSection("workspaces")}
              >
                All workspaces
                <span className="-mr-4 flex h-6 w-6 items-center justify-center rounded p-1 hover:bg-gray-100">
                  <Plus className="h-4 w-4" />
                </span>
              </button>
              <div className="flex items-center">
                <button
                  className="m-2 flex h-6 w-6 items-center justify-center rounded p-1 hover:bg-gray-100"
                  onClick={() => toggleSection("workspaces")}
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      openSection === "workspaces" && "rotate-90",
                    )}
                  />
                </button>
              </div>
            </div>
            {openSection === "workspaces" && (
              <div className="mt-1 space-y-0.5 px-2">
                <div
                  className="flex h-8 items-center gap-2 rounded px-2 text-[13px] font-normal text-[rgb(29,31,37)] hover:bg-[rgb(242,244,248)]"
                >
                  <Users className="h-4 w-4 pr-1 bg-[rgb(242,244,248)]" />
                  My First Workspace
                </div>
                <div
                  className="flex h-8 items-center gap-2 rounded px-2 text-[13px] font-normal text-[rgb(29,31,37)] hover:bg-[rgb(242,244,248)]"
                >
                  <Users className="h-4 w-4 pr-1 bg-[rgb(242,244,248)]" />
                  Workspace
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Bottom Actions */}
      <div className="border-t border-gray-200">
        <div className="flex flex-col px-2 py-2">
          <div className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100">
            <BookOpen className="h-4 w-4 text-gray-500" />
            Templates and apps
          </div>
          <div className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100">
            <ShoppingBag className="h-4 w-4 text-gray-500" />
            Marketplace
          </div>
          <div className="flex h-8 cursor-pointer items-center gap-2 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100">
            <Upload className="h-4 w-4 text-gray-500" />
            Import
          </div>
        </div>
        <div className="px-2 pb-2">
          <CreateBaseButton />
        </div>
      </div>
    </nav>
  );
}

// Export the components
export const Sidebar = {
  Mini,
  Full,
};

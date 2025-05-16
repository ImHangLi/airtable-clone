"use client";

import {
  ChevronRight,
  Users,
  Plus,
  BookOpen,
  ShoppingBag,
  Upload,
  Home,
} from "lucide-react";
import { Button } from "~/components/ui/button";

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
function Full({ handleCreateBase }: { handleCreateBase: () => void }) {
  return (
    <nav className="flex h-full min-h-[597px] flex-col justify-between">
      <div>
        {/* Navigation Section */}
        <div className="mb-2 flex flex-col">
          <div className="flex items-center gap-2 rounded-sm hover:bg-[rgb(242,244,248)]">
            <button className="flex flex-1 cursor-pointer items-center px-3 py-2 text-[15px] font-medium text-gray-700 hover:text-gray-900">
              Home
            </button>
            <button className="m-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded p-1 hover:bg-gray-100">
              <ChevronRight className="h-4 w-4 transition-transform duration-200" />
            </button>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="flex items-center rounded-sm hover:bg-[rgb(242,244,248)]">
          <button className="flex flex-1 cursor-pointer items-center justify-between px-3 py-2 text-[15px] font-medium text-gray-700 hover:text-gray-900">
            All workspaces
            <span className="-mr-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded p-1 hover:bg-gray-100">
              <Plus className="h-4 w-4" />
            </span>
          </button>
          <div className="flex items-center">
            <button className="m-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded p-1 hover:bg-gray-100">
              <ChevronRight className="h-4 w-4 transition-transform duration-200" />
            </button>
          </div>
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
          <Button
            className="h-8 w-full cursor-pointer gap-2 bg-[rgb(45,127,249)] text-[13px] font-semibold hover:bg-[rgb(41,122,241)]"
            onClick={handleCreateBase}
          >
            <Plus className="h-4 w-4" />
            Create
          </Button>
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

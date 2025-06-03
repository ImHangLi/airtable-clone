import { SignedIn, UserButton } from "@clerk/nextjs";
import { Button } from "../ui/button";
import { AirtableLogoWithText } from "../Icons";
import { Bell, Command, HelpCircle, Menu, Search } from "lucide-react";

interface TopNavProps {
  sidebarOpen: boolean;
  setsidebarOpen: (open: boolean) => void;
}

export function TopNav({ sidebarOpen, setsidebarOpen }: TopNavProps) {
  return (
    <header className="flex h-[56px] items-center border-b border-gray-200 bg-white">
      <div className="flex h-12 flex-1 items-center justify-between pr-4 pl-2">
        {/* Left section */}
        <div className="flex min-w-[170px] flex-auto items-center gap-4">
          <Button
            variant="ghost"
            className="h-7 w-7 cursor-pointer rounded-full p-0"
            onClick={() => setsidebarOpen(!sidebarOpen)}
          >
            <Menu className="text-gray-700" width={30} height={30} />
          </Button>
          <AirtableLogoWithText />
        </div>

        {/* Search bar */}
        <div className="ml-6 flex h-8 w-full cursor-pointer items-center gap-2 rounded-full border px-3 shadow-[rgba(0,0,0,0.32)_0px_0px_0.2px_0px,rgba(0,0,0,0.08)_0px_0px_0.5px_0px,rgba(0,0,0,0.08)_0px_0.5px_0.5px_0px] max-lg:max-w-[300px] xl:max-w-[354px]">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            type="search"
            placeholder="Search..."
            className="flex-1 cursor-pointer bg-transparent text-[13px] outline-none placeholder:text-gray-500"
          />
          <div className="flex items-center gap-1 rounded pl-2 text-xs text-gray-500">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex min-w-[170px] flex-auto items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full text-[13px] leading-[1.5] font-normal transition-colors"
          >
            <HelpCircle className="h-4 w-4" strokeWidth={1.5} />
            <span>Help</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[rgb(29, 31, 37)] relative mx-2 h-7 w-7 rounded-full p-0 shadow-[0px_0px_1px_rgba(0,0,0,0.32),0px_0px_2px_rgba(0,0,0,0.08),0px_1px_3px_rgba(0,0,0,0.08)] hover:bg-[rgb(229,233,240)]"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

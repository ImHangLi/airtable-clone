import { SignedIn, UserButton } from "@clerk/nextjs";
import { Button } from "../ui/button";
import { AirtableLogoWithText } from "../Icons";
import { Menu, Search, Command, HelpCircle, Bell } from "lucide-react";
import { cn } from "~/lib/utils";

// Common button styles
const iconButtonClass = "h-7 w-7 p-0 rounded-full cursor-pointer";

interface TopNavButtonProps {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

function TopNavButton({ active, children, className }: TopNavButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 cursor-pointer rounded-full px-3 text-[13px] leading-[1.5] font-normal text-white transition-colors",
        active
          ? "cursor-default bg-[rgba(0,0,0,0.15)] text-[rgba(255,255,255,0.95)] mix-blend-normal shadow-[inset_0px_0px_2px_rgba(0,0,0,0.1),inset_0px_1px_1px_rgba(0,0,0,0.1)]"
          : "hover:bg-opacity-0",
        className,
      )}
    >
      {children}
    </Button>
  );
}

// Search bar component
function SearchBar() {
  return (
    <div className="flex h-8 w-full items-center gap-2 rounded-full border px-3 shadow-sm max-lg:max-w-[300px] xl:max-w-[354px]">
      <Search className="h-4 w-4 text-gray-500" />
      <input
        type="button"
        placeholder="Search..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-500"
      />
      <div className="flex items-center gap-1 rounded pl-2 text-xs text-gray-500">
        <Command className="h-3 w-3" />
        <span>K</span>
      </div>
    </div>
  );
}

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
            className={cn(iconButtonClass, "cursor-pointer")}
            onClick={() => setsidebarOpen(!sidebarOpen)}
          >
            <Menu className="text-gray-700" width={30} height={30} />
          </Button>
          <AirtableLogoWithText />
        </div>

        {/* Search section */}
        <SearchBar />

        {/* Right section */}
        <div className="flex min-w-[170px] flex-auto items-center justify-end gap-2">
          <TopNavButton className="text-[rgb(29, 31, 37)] hover:bg-[rgb(0,0,0,0.1)]">
            <HelpCircle className="h-4 w-4" strokeWidth={1.5} />
          </TopNavButton>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              iconButtonClass,
              "text-[rgb(29, 31, 37)] relative mx-2 shadow-sm hover:bg-[rgb(229,233,240)]",
            )}
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

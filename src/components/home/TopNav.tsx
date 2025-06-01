import { SignedIn, UserButton } from "@clerk/nextjs";
import { Button } from "../ui/button";
import { AirtableLogoWithText } from "../Icons";
import { Menu } from "lucide-react";

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
            className="h-7 w-7 p-0 rounded-full cursor-pointer"
            onClick={() => setsidebarOpen(!sidebarOpen)}
          >
            <Menu className="text-gray-700" width={30} height={30} />
          </Button>
          <AirtableLogoWithText />
        </div>

        {/* Right section */}
        <div className="flex min-w-[170px] flex-auto items-center justify-end gap-2">
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

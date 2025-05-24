import { Plus, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";

interface TableNavProps {
  darkerColor: string;
}

export default function TableNav({ darkerColor }: TableNavProps) {
  // Common styles for better maintainability
  const buttonBaseClasses =
    "relative gap-1 rounded-none rounded-t-[3px] px-3 text-[13px] leading-[18px] font-normal";
  const inactiveTextColor = "text-[rgba(255,255,255,0.85)]";
  const separatorClasses = "h-[12px] w-px bg-[#ffffff26]";

  return (
    <div
      className="relative flex min-h-8 items-center overflow-hidden border-gray-200"
      style={{ backgroundColor: darkerColor }}
    >
      {/* Active Table Tab */}
      <div className="flex items-center pl-3">
        <Button
          variant="ghost"
          size="sm"
          className={`${buttonBaseClasses} cursor-pointer bg-white hover:bg-white`}
        >
          <span className="truncate text-[13px] text-black">Table 1</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Inactive Table Tab */}
      <Button
        variant="ghost"
        size="sm"
        className={`${buttonBaseClasses} ${inactiveTextColor} hover:bg-[#4E535B] hover:text-[rgba(255,255,255,0.95)]`}
        style={{ backgroundColor: darkerColor }}
      >
        <span className="truncate text-[13px] text-[rgba(255,255,255,0.85)]">
          Table 2
        </span>
      </Button>

      {/* Separator */}
      <div className={separatorClasses} />

      {/* Dropdown Button */}
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 rounded-none px-3 ${inactiveTextColor} hover:text-[rgba(255,255,255,0.95)]`}
        style={{ backgroundColor: darkerColor }}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>

      {/* Separator */}
      <div className={separatorClasses} />

      {/* Add Table Button */}
      <Button
        variant="ghost"
        size="sm"
        className={`${buttonBaseClasses} ${inactiveTextColor} hover:text-[rgba(255,255,255,0.95)]`}
        style={{ backgroundColor: darkerColor }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

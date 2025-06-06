import { Plus, WandSparkles } from "lucide-react";

interface FloatingAddRowButtonProps {
  onClick: () => void;
}

export function FloatingAddRowButton({
  onClick,
}: FloatingAddRowButtonProps) {
  return (
    <div
      className="absolute bottom-7 left-4 z-40 flex h-8 w-35 items-center justify-center gap-2 rounded-full border border-gray-300 bg-white text-gray-700 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
      style={{
        width: "120px",
        height: "34px",
      }}
      title="Add row quickly"
      aria-label="Add new row"
    >
      <button
        className="flex h-full w-1/3 cursor-pointer items-center justify-center rounded-l-full border-r border-gray-300 hover:bg-gray-100"
        onClick={onClick}
      >
        <Plus className="h-4 w-4" />
      </button>
      <button className="flex w-2/3 cursor-pointer items-center justify-start gap-1.5 rounded-r-full">
        <WandSparkles className="h-4 w-4" />
        <span className="text-[13px] font-medium">Add...</span>
      </button>
    </div>
  );
}

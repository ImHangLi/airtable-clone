import { Grid, Plus, Search } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export default function ViewSide() {
  return (
    <div className="flex min-h-0 min-w-[270px] flex-col border-r border-gray-200 bg-gray-50/50 px-3">
      <div className="flex h-full flex-1 flex-col justify-between">
        <div className="p-2">
          <div className="relative border-b border-gray-200">
            <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Find a view"
              className="h-7 w-full border-none bg-white pl-7 text-[13px] shadow-none placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="h-full flex-1 p-1">
          <div className="space-y-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 rounded px-2 text-[13px] font-normal text-gray-700"
            >
              <Grid className="h-4 w-4 text-blue-600" />
              Grid view
            </Button>
          </div>
        </div>

        <div className="mx-auto h-[1px] w-full bg-gray-200" />

        <div className="px-2">
          <div className="flex items-center justify-between py-[11px] pl-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-between gap-2 rounded px-2 text-[13px] font-normal text-gray-700 hover:bg-gray-100"
            >
              <div className="flex items-center gap-2">
                <Grid className="h-4 w-4 text-blue-600" />
                <p>Grid</p>
              </div>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

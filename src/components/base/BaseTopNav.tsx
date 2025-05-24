import { UserButton } from "@clerk/nextjs";
import { AirtableLogo } from "../Icons";

export default function BaseTopNav({
  baseName,
  baseColor,
}: {
  baseName: string | undefined;
  baseColor: string | undefined;
}) {
  return (
    <header
      className="flex min-h-[56px] items-center px-4 pl-5"
      style={{ backgroundColor: baseColor }}
    >
      <div className="flex h-12 flex-1 items-center justify-between">
        <div className="flex items-center">
          <div className="flex min-w-[60px] items-center gap-3">
            <AirtableLogo />
            <div className="flex items-center">
              <span className="text-[17px] leading-6 font-[675] tracking-[-0.16px] text-white">
                {baseName}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <div className="ml-2 flex items-center">
            <UserButton />
          </div>
        </div>
      </div>
    </header>
  );
}

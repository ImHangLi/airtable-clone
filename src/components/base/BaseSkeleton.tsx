export default function BaseSkeleton({ baseColor }: { baseColor: string }) {
  return (
    <div className="flex h-screen flex-col bg-white">
      <header
        className="flex h-[56px] items-center px-4 pl-5"
        style={{ backgroundColor: baseColor }}
      ></header>
    </div>
  );
}

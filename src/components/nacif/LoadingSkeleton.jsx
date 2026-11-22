import { cn } from "@/lib/utils";

export function SkeletonBox({ className = "" }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/70", className)} />;
}

export default function LoadingSkeleton({ variant = "dashboard" }) {
  if (variant === "table") {
    return (
      <div className="space-y-3 rounded-2xl border border-[#E5EBF1] bg-white p-4">
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="h-9 w-full" />
        <SkeletonBox className="h-9 w-full" />
        <SkeletonBox className="h-9 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2.16fr)_minmax(300px,1fr)]">
        <SkeletonBox className="h-[238px] rounded-[18px]" />
        <SkeletonBox className="h-[238px] rounded-[18px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBox key={i} className="h-[60px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.05fr)_minmax(300px,1fr)]">
        <SkeletonBox className="h-[200px] rounded-2xl" />
        <SkeletonBox className="h-[200px] rounded-2xl" />
        <SkeletonBox className="h-[200px] rounded-2xl" />
      </div>
    </div>
  );
}

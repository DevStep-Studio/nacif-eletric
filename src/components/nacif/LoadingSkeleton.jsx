import { cn } from "@/lib/utils";

export function SkeletonBox({ className = "" }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/70", className)} />;
}

export default function LoadingSkeleton({ variant = "dashboard" }) {
  if (variant === "table") {
    return (
      <div className="space-y-3 rounded-2xl border border-[#E5EBF1] bg-white p-5">
        <SkeletonBox className="h-6 w-48" />
        <SkeletonBox className="h-10 w-full" />
        <SkeletonBox className="h-10 w-full" />
        <SkeletonBox className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <SkeletonBox className="h-64 rounded-3xl lg:col-span-8" />
        <SkeletonBox className="h-64 rounded-3xl lg:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBox key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <SkeletonBox className="h-64 rounded-2xl lg:col-span-4" />
        <SkeletonBox className="h-64 rounded-2xl lg:col-span-5" />
        <SkeletonBox className="h-64 rounded-2xl lg:col-span-3" />
      </div>
    </div>
  );
}

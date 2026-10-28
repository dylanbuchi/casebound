import { Loading, Skeleton } from "@/components/states";

export default function CaseLoading() {
  return (
    <div className="space-y-8">
      <Loading label="Opening the case file" />
      <div className="space-y-3 border-b border-rule pb-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-3/4 max-w-2xl" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="rounded-xl border-2 border-rule bg-card p-6 md:p-8">
        <Skeleton className="h-10 w-1/2 max-w-sm" />
        <Skeleton className="mt-4 h-5 w-full max-w-3xl" />
        <Skeleton className="mt-2 h-5 w-2/3 max-w-2xl" />
        <Skeleton className="mt-8 h-9 w-full" />
        <Skeleton className="mt-4 h-6 w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

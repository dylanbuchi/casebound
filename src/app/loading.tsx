import { Loading, Skeleton } from "@/components/states";

export default function InboxLoading() {
  return (
    <div className="space-y-8">
      <Loading label="Fetching disputes from PayPal" />
      <div className="space-y-3">
        <Skeleton className="h-12 w-2/3 max-w-xl" />
        <Skeleton className="h-5 w-full max-w-2xl" />
        <Skeleton className="h-5 w-1/2 max-w-md" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card px-5 py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-lg border border-rule bg-card p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

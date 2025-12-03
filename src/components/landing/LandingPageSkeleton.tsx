import { Skeleton } from "@/components/ui/skeleton";

export function LandingPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Skeleton className="h-8 w-32" />
            <div className="hidden lg:flex items-center gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-4 w-20" />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Skeleton */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Skeleton className="h-8 w-64" />
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-3/4" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-12 w-36" />
                <Skeleton className="h-12 w-36" />
              </div>
            </div>
            <div className="hidden lg:block">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Skeleton */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-6 bg-background rounded-xl">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

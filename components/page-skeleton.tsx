import { Skeleton } from "@/components/ui/skeleton";

// Заглушка на время загрузки страницы: после клика по меню сразу видна разметка раздела,
// а не «зависший» старый экран. Формы повторяют настоящие страницы, чтобы ничего не прыгало.
export function PageSkeleton({ kind = "list" }: { kind?: "dashboard" | "map" | "list" | "detail" }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      {kind === "dashboard" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </>
      )}
      {kind === "map" && <Skeleton className="h-[70vh] rounded-xl" />}
      {kind === "list" &&
        Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      {kind === "detail" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}

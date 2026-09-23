import { requireRole } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";

// Разделы акимата — в боковом меню приложения (components/app-shell/app-sidebar.tsx)
export default async function AkimatLayout({ children }: LayoutProps<"/akimat">) {
  await requireRole("akimat", "operator");
  const { t } = await getDict();
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      <p className="mx-auto w-full max-w-7xl px-4 pb-6 text-xs text-muted-foreground">
        {t.akimat.flowNote}
      </p>
    </div>
  );
}

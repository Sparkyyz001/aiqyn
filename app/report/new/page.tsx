import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { ReportForm } from "./report-form";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.report };
}

export default async function NewReportPage() {
  const [{ lang, t }, me] = await Promise.all([getDict(), getProfile()]);
  if (!me) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{t.report.newTitle}</h1>
        <p className="text-muted-foreground">{t.report.loginNeeded}</p>
        <Button asChild>
          <Link href="/login?next=/report/new">
            <LogIn /> {t.nav.login}
          </Link>
        </Button>
      </div>
    );
  }
  return <ReportForm userId={me.id} lang={lang} t={{ report: t.report, common: t.common, card: t.card, status: t.status, operator: t.operator, routing: t.routing }} />;
}

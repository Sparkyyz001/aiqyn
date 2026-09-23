import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkEscalation } from "@/lib/escalation-access";
import { buildEscalationPayload, escalationText } from "@/lib/escalation";
import { EscalateClient } from "./escalate-client";
import { getDict } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.escalate.title };
}

export default async function EscalatePage({ params }: PageProps<"/report/[no]/escalate">) {
  const { no } = await params;
  const db = createAdminClient();
  const { data: r } = await db.from("reports").select("id, public_no, title").eq("public_no", no).maybeSingle();
  if (!r) notFound();

  const chk = await checkEscalation(r.id);
  const { t } = await getDict();
  const back = (
    <Link href={`/report/${no}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> {no}
    </Link>
  );
  if (!chk.ok)
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {back}
        <p className="mt-4 rounded-lg border p-4 text-sm">{chk.error}</p>
      </div>
    );

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const preview = await buildEscalationPayload(r.id, { full_name: chk.me.full_name ?? "", contact: null }, origin);
  const { data: prev } = await db
    .from("escalations")
    .select("id, created_at, eotinish_ref")
    .eq("report_id", r.id)
    .eq("created_by", chk.me.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {back}
      <h1 className="mt-2 text-xl font-semibold">{t.escalate.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.escalate.intro}
      </p>
      <EscalateClient
        reportId={r.id}
        defaultName={chk.me.full_name ?? ""}
        previewText={preview ? escalationText(preview) : ""}
        previous={prev ?? []}
        t={t.escalate}
      />
    </div>
  );
}

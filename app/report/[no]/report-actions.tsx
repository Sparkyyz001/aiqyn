"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, FileWarning, Loader2, Play, ThumbsDown, ThumbsUp, X, Eye, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmReport, castVerification, staffTransition, submitCompletion, addReply } from "@/lib/actions/reports";
import { uploadPhoto, type UploadedPhoto } from "@/lib/photo";
import { fmt, type Dict } from "@/lib/i18n/dict";

type Props = {
  report: { id: number; status: string; public_no: string; verification_due_at: string | null };
  viewer: { id: string; role: string } | null;
  isAuthor: boolean;
  isConfirmer: boolean;
  myVote: string | null;
  isStaff: boolean;
  canEscalate: boolean;
  t: Pick<Dict, "card" | "common" | "nav" | "actions" | "photoReasons">;
};

export function ReportActions({ report, viewer, isAuthor, isConfirmer, myVote, isStaff, canEscalate, t }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [comment, setComment] = useState("");
  const [afterPhoto, setAfterPhoto] = useState<UploadedPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = report.status;
  const open = !["resolved", "rejected"].includes(s);

  const run = (fn: () => Promise<{ ok: boolean; error?: string } & Record<string, unknown>>, okText?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? t.actions.error);
      if (okText) toast.success(okText);
      setComment("");
      router.refresh();
    });

  const onAfter = async (f: File | undefined) => {
    if (!f || !viewer) return;
    setUploading(true);
    try {
      setAfterPhoto(await uploadPhoto(f, viewer.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const blocks: React.ReactNode[] = [];

  // ФИШКА 1: голосование жителей
  if (s === "awaiting_confirmation" && (isAuthor || isConfirmer)) {
    blocks.push(
      <div key="vote" className="rounded-lg border-2 border-[color:var(--warn)] bg-warn/5 p-4">
        <div className="font-medium">{t.card.voteTitle}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.card.voteWho}</p>
        {report.verification_due_at && (
          <p className="text-xs text-muted-foreground">
            {t.card.voteUntil} {new Date(report.verification_due_at).toLocaleString("ru-RU", { timeZone: "Asia/Aqtau", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        {myVote ? (
          <p className="mt-3 text-sm font-medium">{t.card.voted}: {myVote === "fixed" ? t.card.voteYes : t.card.voteNo}</p>
        ) : (
          <>
            <Textarea className="mt-3" rows={2} placeholder={t.actions.commentPh} value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button disabled={pending} onClick={() => run(() => castVerification(report.id, "fixed", comment), t.card.voted)} className="bg-[color:var(--ok)] text-white hover:bg-[color:var(--ok)]/90">
                <ThumbsUp /> {t.card.voteYes}
              </Button>
              <Button disabled={pending} variant="destructive" onClick={() => run(() => castVerification(report.id, "not_fixed", comment), t.card.voted)}>
                <ThumbsDown /> {t.card.voteNo}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // «Я тоже это вижу»
  if (open && viewer && !isAuthor && !isConfirmer && !isStaff) {
    blocks.push(
      <Button key="confirm" variant="outline" size="lg" disabled={pending} onClick={() => run(() => confirmReport(report.id), t.actions.iSeeTooOk)}>
        <Eye /> {t.card.iSeeToo}
      </Button>
    );
  }

  // Действия службы
  if (isStaff && open) {
    blocks.push(
      <div key="staff" className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <div className="text-sm font-medium">{t.nav.service}</div>
        <Textarea rows={2} placeholder={t.actions.replyPh} value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {["new", "routed", "reopened"].includes(s) && (
            <Button disabled={pending} onClick={() => run(() => staffTransition(report.id, "accept", comment), t.actions.accepted)}>
              <Check /> {t.actions.accept}
            </Button>
          )}
          {["accepted", "reopened"].includes(s) && (
            <Button disabled={pending} variant="secondary" onClick={() => run(() => staffTransition(report.id, "start", comment))}>
              <Play /> {t.actions.start}
            </Button>
          )}
          {comment.trim() && (
            <Button disabled={pending} variant="outline" onClick={() => run(() => addReply(report.id, comment))}>
              <Send /> {t.actions.reply}
            </Button>
          )}
          {["new", "routed", "accepted"].includes(s) && (
            <Button disabled={pending || !comment.trim()} variant="ghost" onClick={() => run(() => staffTransition(report.id, "reject", comment))} title={t.actions.rejectHint}>
              <X /> {t.actions.reject}
            </Button>
          )}
        </div>
        {["accepted", "in_progress", "reopened"].includes(s) && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <div className="text-sm">{t.actions.afterHint}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <Camera />} {t.actions.afterPhoto}
              </Button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onAfter(e.target.files?.[0])} />
              {afterPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={afterPhoto.preview} alt="" className="size-12 rounded object-cover" />
              )}
              <Button
                disabled={pending || !afterPhoto}
                onClick={() =>
                  start(async () => {
                    const res = await submitCompletion(report.id, afterPhoto!, comment);
                    if (!res.ok) return void toast.error(res.error);
                    if (res.data.geo_verified) toast.success(t.actions.sentOk);
                    else
                      toast.warning(
                        fmt(t.actions.sentWarn, {
                          r: res.data.reasons.map((x) => fmt(t.photoReasons[x.code as keyof Dict["photoReasons"]] ?? x.code, { d: x.d ?? "", max: x.max ?? "" })).join("; "),
                        })
                      );
                    setAfterPhoto(null);
                    setComment("");
                    router.refresh();
                  })
                }
              >
                <Check /> {t.actions.done}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Эскалация в eOtinish
  if (canEscalate && (isAuthor || isConfirmer || isStaff) && s !== "resolved") {
    blocks.push(
      <div key="esc" className="rounded-lg border border-[color:var(--danger)]/40 p-4">
        <Button asChild variant="destructive">
          <Link href={`/report/${report.public_no}/escalate`}>
            <FileWarning /> {t.card.escalate}
          </Link>
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">{t.card.escalateHint}</p>
      </div>
    );
  }

  if (!viewer && open) {
    blocks.push(
      <Button key="login" asChild variant="outline">
        <Link href={`/login?next=/report/${report.public_no}`}>{t.actions.loginToConfirm}</Link>
      </Button>
    );
  }

  return blocks.length ? <div className="flex flex-col gap-3">{blocks}</div> : null;
}

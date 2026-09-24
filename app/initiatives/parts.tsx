"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { proposeInitiative, voteInitiative, decideInitiative } from "@/lib/actions/initiatives";
import type { Dict } from "@/lib/i18n/dict";

type T = Dict["initiatives"];

export function VoteBlock({ id, votes, voted, canVote, loggedIn, threshold, t }: { id: number; votes: number; voted: boolean; canVote: boolean; loggedIn: boolean; threshold: number; t: T }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(voted);
  const [count, setCount] = useState(votes);
  const pct = Math.min(100, Math.round((count / threshold) * 100));
  const vote = () =>
    start(async () => {
      setDone(true);
      setCount((c) => c + 1); // сразу видно, что голос учтён; сервер подтвердит
      const r = await voteInitiative(id);
      if (!r.ok) {
        setDone(voted);
        setCount(votes);
        return void toast.error(r.error);
      }
      setCount(r.data.votes);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-48 flex-1">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums">
            {new Intl.NumberFormat("ru-RU").format(count)} <span className="font-normal text-muted-foreground">{t.votes}</span>
          </span>
          {canVote && <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>}
        </div>
        {canVote && (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      {canVote &&
        (loggedIn ? (
          <Button variant={done ? "outline" : "default"} disabled={done || pending} onClick={vote} className="transition-transform duration-300 active:scale-95">
            {pending ? <Loader2 className="animate-spin" /> : done ? <Check /> : <ThumbsUp />} {done ? t.voted : t.vote}
          </Button>
        ) : (
          <a href="/login?next=/initiatives" className="text-sm text-primary hover:underline">{t.loginToVote}</a>
        ))}
    </div>
  );
}

export function ProposeForm({ t, districts }: { t: T; districts: { code: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [district, setDistrict] = useState<string>("");
  const [kind, setKind] = useState("improvement");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="btn-shine">
          <Plus /> {t.propose}
        </Button>
      </DialogTrigger>
      <DialogContent className="z-[1300]">
        <DialogHeader>
          <DialogTitle>{t.proposeTitle}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="it-title">{t.fTitle}</Label>
            <Input id="it-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.fTitlePh} maxLength={140} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="it-desc">{t.fDesc}</Label>
            <Textarea id="it-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={1500} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t.fDistrict}</Label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="z-[1400] max-h-72">
                  {districts.map((d) => (
                    <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t.fKind}</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[1400]">
                  {Object.entries(t.kind).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            disabled={pending || title.trim().length < 5}
            onClick={() =>
              start(async () => {
                const r = await proposeInitiative({ title, description: desc, district: district || null, kind });
                if (!r.ok) return void toast.error(r.error);
                toast.success(t.sent);
                setOpen(false);
                setTitle("");
                setDesc("");
                router.push(`/initiatives#i-${r.data.id}`);
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} {t.send}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DecideForm({ id, status, reply, budget, t }: { id: number; status: string; reply: string; budget: number | null; t: T }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(status);
  const [text, setText] = useState(reply);
  const [money, setMoney] = useState(budget ? String(budget) : "");
  return (
    <details className="mt-4 rounded-xl border border-dashed p-3 text-sm">
      <summary className="cursor-pointer font-medium">{t.decide}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]">
        <Select value={s} onValueChange={setS}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[1300]">
            {Object.entries(t.status).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={money} onChange={(e) => setMoney(e.target.value.replace(/\D/g, ""))} placeholder={`${t.budget}, ₸`} inputMode="numeric" />
        <Textarea className="sm:col-span-2" value={text} onChange={(e) => setText(e.target.value)} placeholder={t.reply} rows={2} />
        <Button
          className="sm:col-span-2 sm:justify-self-start"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await decideInitiative(id, { status: s, reply: text, budget: money ? Number(money) : null });
              if (!r.ok) return void toast.error(r.error);
              toast.success(t.saved);
              router.refresh();
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />} {t.save}
        </Button>
      </div>
    </details>
  );
}

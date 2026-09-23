import { redirect } from "next/navigation";

export default async function Redirect({ params }: PageProps<"/akimat/pain/[code]">) {
  const { code } = await params;
  redirect(`/district/${code}`);
}

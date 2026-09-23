import { getDict } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";
import { googleEnabled } from "@/lib/auth-providers";

export async function generateMetadata() {
  const { t } = await getDict();
  return { title: t.nav.login };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { t } = await getDict();
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const mode = sp.mode === "signup" ? "signup" : "signin";
  const google = await googleEnabled();
  const oauthError = sp.error === "oauth";
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <LoginForm t={t} next={next} mode={mode} google={google} oauthError={oauthError} />
    </div>
  );
}

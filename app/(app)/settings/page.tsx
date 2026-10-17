import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { DeleteAccountForm } from "./delete-account-form";
import { PreferencesForm } from "./preferences-form";
import { withUser } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import { authDb } from "@/lib/db";
import { twoFactorStatus } from "@/lib/auth/two-factor";
import { TwoFactorCard } from "./two-factor-card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const prefs = await withUser(user.id, (tx) =>
    tx.user.findFirst({ where: { id: user.id }, select: { theme: true, defaultCurrency: true, emailReminders: true } }),
  );
  const [twoFactor, account] = await Promise.all([
    twoFactorStatus(user.id),
    authDb().user.findUnique({ where: { id: user.id }, select: { passwordHash: true, accounts: { select: { provider: true } } } }),
  ]);
  const linked = account?.accounts.map((a) => (a.provider === "github" ? "GitHub" : a.provider === "google" ? "Google" : a.provider)) ?? [];
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title="Settings" />
      <Card className="flex flex-col gap-2 p-6">
        <h2 className="text-lg font-semibold text-text">Account</h2>
        <dl className="grid gap-x-6 gap-y-1 text-sm tab:grid-cols-[8rem_1fr]">
          <dt className="text-secondary">Name</dt>
          <dd className="text-text">{user.name ?? "Not set"}</dd>
          <dt className="text-secondary">Email</dt>
          <dd className="break-all text-text">{user.email}</dd>
          <dt className="text-secondary">Sign-in</dt>
          <dd className="text-text">{[account?.passwordHash ? "Password" : null, ...linked].filter(Boolean).join(", ") || "None"}</dd>
        </dl>
      </Card>
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-text">Two-factor login</h2>
        <TwoFactorCard enabled={twoFactor.enabled} codesLeft={twoFactor.codesLeft} />
      </Card>
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-text">Preferences</h2>
        <PreferencesForm theme={prefs?.theme ?? "SYSTEM"} defaultCurrency={prefs?.defaultCurrency ?? "KES"} emailReminders={prefs?.emailReminders ?? false} />
      </Card>
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text">Export my data</h2>
          <p className="text-sm text-secondary">Download everything we store about you. The ZIP has your data and every file you uploaded.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/api/export?format=zip" className={buttonVariants({ variant: "primary" })}>
            Download everything with files (ZIP)
          </a>
          <a href="/api/export?format=json" className={buttonVariants({ variant: "secondary" })}>
            Data only (JSON)
          </a>
          <a href="/api/export?format=csv" className={buttonVariants({ variant: "secondary" })}>
            Download jobs (CSV)
          </a>
        </div>
      </Card>
      <Card className="flex flex-col gap-4 border-danger/40 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text">Delete account</h2>
          <p className="text-sm text-secondary">
            Permanently delete your account and everything in it. All records and files are removed within 24 hours.
          </p>
        </div>
        <DeleteAccountForm hasPassword={Boolean(account?.passwordHash)} needsCode={twoFactor.enabled} />
      </Card>
    </div>
  );
}

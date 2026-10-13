import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
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
        </dl>
      </Card>
      <Card className="flex flex-col gap-4 border-danger/40 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text">Delete account</h2>
          <p className="text-sm text-secondary">
            Permanently delete your account and everything in it. All records and files are removed within 24 hours.
          </p>
        </div>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}

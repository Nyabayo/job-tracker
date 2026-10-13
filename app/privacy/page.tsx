import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Privacy" };

const stored = [
  ["Your email address and name", "To log you in and send the emails you ask for (confirmations, password resets, reminders)."],
  ["Your password, scrambled with Argon2id", "To check it's you. We can never see or recover the original password."],
  ["The jobs, notes, contacts and tasks you add", "This is the tracker itself. Only you can see them."],
  ["Files you upload (CVs, cover letters, certificates)", "Stored privately and only downloadable by you, after a virus scan."],
  ["A security log: logins, failed logins, downloads and exports", "To spot attacks on your account. IP addresses are shortened before they're saved."],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-safe py-8 tab:px-8">
      <header>
        <Link href="/" aria-label="Job Tracker home" className="inline-flex min-h-11 items-center rounded-[10px]">
          <Logo />
        </Link>
      </header>
      <main id="main" className="flex flex-col gap-8 pb-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold text-text">Privacy</h1>
          <p className="text-lg text-secondary">
            Job Tracker collects only what it needs to work. There are no ads, no analytics scripts and no third-party
            trackers. We follow the Kenya Data Protection Act 2019 and GDPR principles.
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-text">What we store and why</h2>
          <div tabIndex={0} role="region" aria-label="What we store and why" className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th scope="col" className="p-4 font-semibold text-text">What</th>
                  <th scope="col" className="p-4 font-semibold text-text">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stored.map(([what, why]) => (
                  <tr key={what}>
                    <td className="p-4 align-top text-text">{what}</td>
                    <td className="p-4 align-top text-secondary">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-text">Who can see your data</h2>
          <p className="text-secondary">
            Only you. Every record is tied to your account and the database itself refuses to show it to anyone else.
            We don’t sell or share your data, and nothing you store is sent to outside services.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-text">Your rights</h2>
          <ul className="list-disc space-y-2 pl-5 text-secondary">
            <li>Export everything you’ve stored as JSON, CSV and a ZIP of your files (coming soon).</li>
            <li>
              Delete your account at any time from Settings. Everything, including your files, is permanently removed
              within 24 hours.
            </li>
            <li>Ask the person running this copy of Job Tracker what they hold about you.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-text">Cookies</h2>
          <p className="text-secondary">
            Two cookies, both only sent to this site. One keeps you logged in and can’t be read by scripts. The other
            holds a random code that stops other websites from submitting forms as you. No other cookies are used.
          </p>
        </section>
      </main>
    </div>
  );
}

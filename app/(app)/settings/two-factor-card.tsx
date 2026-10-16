"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { useCsrfToken } from "@/components/security/csrf";
import { CSRF_FIELD } from "@/lib/security/csrf-shared";
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  newRecoveryCodesAction,
  startTwoFactorAction,
  type TwoFactorResult,
} from "./actions";

type Mode = "idle" | "setup" | "disable" | "regenerate";

/** A4: turn two-factor login on or off, and manage recovery codes. */
export function TwoFactorCard({ enabled, codesLeft }: { enabled: boolean; codesLeft: number }) {
  const csrf = useCsrfToken();
  const [mode, setMode] = useState<Mode>("idle");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [result, setResult] = useState<TwoFactorResult | null>(null);
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: (input: unknown) => Promise<TwoFactorResult>, after?: (res: TwoFactorResult) => void) {
    setResult(null);
    startTransition(async () => {
      const res = await action({ code, [CSRF_FIELD]: csrf });
      setResult(res);
      if (res.ok) {
        setCode("");
        after?.(res);
      }
    });
  }

  const error = result && !result.ok ? (result.fieldErrors?.code?.[0] ?? result.message) : undefined;

  if (codes) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="success">{result?.message ?? "Two-factor login is on."}</Alert>
        <p className="text-sm text-text">
          Save these recovery codes somewhere safe, like a password manager. Each one works once if you lose your phone. They
          won&apos;t be shown again.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-ground p-4 font-mono text-sm text-text" aria-label="Recovery codes">
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button variant="secondary" className="self-start" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>
          Copy codes
        </Button>
        <Button className="self-start" onClick={() => { setCodes(null); setMode("idle"); setResult(null); }}>
          I&apos;ve saved them
        </Button>
      </div>
    );
  }

  if (!enabled && mode === "setup" && setup) {
    return (
      <div className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-text">
          <li>
            Open an authenticator app (such as Google Authenticator, Microsoft Authenticator, Aegis or 1Password) and add an
            account. On this phone you can{" "}
            <a href={setup.uri} className="font-semibold text-primary underline underline-offset-2">
              open it in your app
            </a>
            .
          </li>
          <li>
            Or type this setup key:
            <code className="mt-1 block break-all rounded-lg border border-border bg-ground p-3 font-mono text-text">
              {setup.secret.match(/.{1,4}/g)?.join(" ")}
            </code>
          </li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(confirmTwoFactorAction, (res) => setCodes(res.recoveryCodes ?? null));
          }}
        >
          <Field label="6-digit code" autoComplete="one-time-code" inputMode="numeric" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} error={error} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>{pending ? "Checking..." : "Turn on"}</Button>
            <Button variant="secondary" onClick={() => { setMode("idle"); setSetup(null); setResult(null); }} disabled={pending}>Cancel</Button>
          </div>
        </form>
      </div>
    );
  }

  if (enabled && (mode === "disable" || mode === "regenerate")) {
    const action = mode === "disable" ? disableTwoFactorAction : newRecoveryCodesAction;
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(action, (res) => {
            if (res.recoveryCodes) setCodes(res.recoveryCodes);
            else setMode("idle");
          });
        }}
      >
        <Field
          label="Code from your app, or a recovery code"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={error}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant={mode === "disable" ? "danger" : "primary"} disabled={pending}>
            {mode === "disable" ? "Turn off two-factor login" : "Get new recovery codes"}
          </Button>
          <Button variant="secondary" onClick={() => { setMode("idle"); setResult(null); }} disabled={pending}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {result?.ok && result.message ? <Alert tone="success">{result.message}</Alert> : null}
      {result && !result.ok && result.message ? <Alert tone="danger">{result.message}</Alert> : null}
      {enabled ? (
        <>
          <p className="text-sm text-text">
            Two-factor login is <strong>on</strong>. You have {codesLeft} unused recovery code{codesLeft === 1 ? "" : "s"}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setMode("regenerate")}>Get new recovery codes</Button>
            <Button variant="danger" onClick={() => setMode("disable")}>Turn off</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-secondary">Ask for a code from an authenticator app each time you log in, as well as your password.</p>
          <Button
            className="self-start"
            disabled={pending}
            onClick={() => run(startTwoFactorAction, (res) => { if (res.secret && res.uri) { setSetup({ secret: res.secret, uri: res.uri }); setMode("setup"); } })}
          >
            Set up two-factor login
          </Button>
        </>
      )}
    </div>
  );
}

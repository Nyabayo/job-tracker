"use client";

import { ActionForm, useFormPending } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/board/constants";
import { savePreferencesAction } from "./actions";

function Save() {
  const pending = useFormPending();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save settings"}
    </Button>
  );
}

export function PreferencesForm({ theme, defaultCurrency, emailReminders }: { theme: string; defaultCurrency: string; emailReminders: boolean }) {
  return (
    <ActionForm action={savePreferencesAction} label="Preferences" className="flex flex-col gap-4">
      <SelectField
        name="theme"
        label="Theme"
        defaultValue={theme}
        options={[
          { value: "SYSTEM", label: "Same as my device" },
          { value: "LIGHT", label: "Light" },
          { value: "DARK", label: "Dark" },
        ]}
      />
      <SelectField name="defaultCurrency" label="Default salary currency" defaultValue={defaultCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="emailReminders" defaultChecked={emailReminders} className="size-11 shrink-0 cursor-pointer accent-[var(--primary)]" />
        <span>Email me reminders for tasks, interviews and deadlines</span>
      </label>
      <div>
        <Save />
      </div>
    </ActionForm>
  );
}

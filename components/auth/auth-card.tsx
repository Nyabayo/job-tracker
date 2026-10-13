import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AuthCard({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-6 p-6 tab:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        {intro ? <p className="text-secondary">{intro}</p> : null}
      </div>
      {children}
      {footer ? <div className="border-t border-border pt-4 text-sm text-secondary [&_a]:inline-flex [&_a]:min-h-11 [&_a]:min-w-11 [&_a]:items-center [&_a]:justify-center">{footer}</div> : null}
    </Card>
  );
}

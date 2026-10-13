import type { Metadata } from "next";
import { SquareKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Board" description="Every application, from wishlist to offer." />
      <EmptyState icon={SquareKanban} title="Your board is ready">
        Your five stages are set up: Wishlist, Applied, Interview, Offer and Rejected. Adding jobs arrives in the next
        update.
      </EmptyState>
    </div>
  );
}

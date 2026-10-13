import { BottomTabs } from "@/components/layout/bottom-tabs";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { requireUser } from "@/lib/auth/session";

/**
 * The signed-in app shell (section 5):
 * phones get a bottom tab bar, tablets an icon rail, desktops a full sidebar.
 * Content is capped and centred on ultrawide screens.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar name={user.name} email={user.email} />
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-safe pb-28 pt-6 tab:px-6 tab:pb-10">
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}

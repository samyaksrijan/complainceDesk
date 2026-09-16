import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-base print:block print:h-auto print:overflow-visible">
      <div className="hidden lg:block print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-col flex-1 overflow-hidden print:block print:overflow-visible">
        <div className="print:hidden">
          <DashboardHeader />
        </div>
        <main className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
          <div className="mx-auto max-w-7xl print:max-w-none">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

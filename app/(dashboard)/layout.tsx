import { AnalysisStatusProvider } from "@/components/providers/AnalysisStatusProvider";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardWebmcpTools } from "@/components/dashboard/DashboardWebmcpTools";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AnalysisStatusProvider>
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" className="flex-1 px-6 py-6">
            {children}
          </main>
        </div>
        <DashboardWebmcpTools />
      </div>
    </AnalysisStatusProvider>
  );
}

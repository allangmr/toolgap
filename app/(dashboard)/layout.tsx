import { AnalysisStatusProvider } from "@/components/providers/AnalysisStatusProvider";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardWebmcpTools } from "@/components/dashboard/DashboardWebmcpTools";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnalysisStatusProvider>
      <div className="flex min-h-[100dvh] flex-col lg:flex-row">
        <DashboardSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="main" className="flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
        <DashboardWebmcpTools />
      </div>
    </AnalysisStatusProvider>
  );
}

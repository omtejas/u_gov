import React from "react";
import { GovProvider, useGov } from "./context/GovContext";
import { Header } from "./components/layout/Header";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { MobileNav } from "./components/layout/MobileNav";
import { FloatingGBot } from "./components/ai/FloatingGBot";
import { GBotModal } from "./components/ai/GBotModal";
import { ExplainModal } from "./components/ai/ExplainModal";
import { ServiceDetailsModal } from "./components/services/ServiceDetailsModal";
import { ApplicationWorkflowModal } from "./components/applications/ApplicationWorkflowModal";

// Views
import { HomeView } from "./views/HomeView";
import { ServicesView } from "./views/ServicesView";
import { DashboardView } from "./views/DashboardView";
import { DocumentsView } from "./views/DocumentsView";
import { TrackerView } from "./views/TrackerView";
import { AuthView } from "./views/AuthView";
import { GrievanceView } from "./views/GrievanceView";
import { AuditView } from "./views/AuditView";
import { AdminView } from "./views/AdminView";

const AppContent: React.FC = () => {
  const { activeTab, isAuthenticated } = useGov();

  const renderView = () => {
    if (!isAuthenticated) {
      return <AuthView />;
    }

    switch (activeTab) {
      case "home":
        return <HomeView />;
      case "services":
        return <ServicesView />;
      case "dashboard":
        return <DashboardView />;
      case "documents":
        return <DocumentsView />;
      case "tracker":
        return <TrackerView />;
      case "grievance":
        return <GrievanceView />;
      case "audit":
        return <AuditView />;
      case "admin":
        return <AdminView />;
      case "auth":
        return <AuthView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fc] text-[#191c1e]">
      {/* Sovereign Top Header */}
      <Header />

      {/* Sub-Header Navigation Bar */}
      {isAuthenticated && <Navbar />}

      {/* Main Content Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 ${isAuthenticated ? "pt-32" : "pt-24"} pb-12`}>
        {renderView()}
      </main>

      {/* Sovereign Footer */}
      <Footer />

      {/* Floating Elements & Modals */}
      <FloatingGBot />
      <GBotModal />
      <ExplainModal />
      <ServiceDetailsModal />
      <ApplicationWorkflowModal />

      {/* Mobile Navigation */}
      {isAuthenticated && <MobileNav />}
    </div>
  );
};

export function App() {
  return (
    <GovProvider>
      <AppContent />
    </GovProvider>
  );
}

export default App;

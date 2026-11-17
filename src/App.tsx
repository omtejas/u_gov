import React, { useState, useEffect } from "react";
import { GovProvider, useGov } from "./context/GovContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Header } from "./components/layout/Header";
import { Navbar } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { MobileNav } from "./components/layout/MobileNav";
import { FloatingGBot } from "./components/ai/FloatingGBot";
import { GBotModal } from "./components/ai/GBotModal";
import { ExplainModal } from "./components/ai/ExplainModal";
import { ServiceDetailsModal } from "./components/services/ServiceDetailsModal";
import { ApplicationWorkflowModal } from "./components/applications/ApplicationWorkflowModal";
import { OnboardingTutorial } from "./components/ui/OnboardingTutorial";
import { HomeView } from "./views/HomeView";
import { ServicesView } from "./views/ServicesView";
import { DashboardView } from "./views/DashboardView";
import { DocumentsView } from "./views/DocumentsView";
import { TrackerView } from "./views/TrackerView";
import { AuthView } from "./views/AuthView";
import { GrievanceView } from "./views/GrievanceView";
import { AuditView } from "./views/AuditView";
import { AdminView } from "./views/AdminView";
import { ConsentCenterView } from "./views/ConsentCenterView";
import { NotificationsView } from "./views/NotificationsView";
import { FAQView } from "./views/FAQView";
import { MyDataView } from "./views/MyDataView";
import { WhereAmIView } from "./views/WhereAmIView";
import { OfficerDeskView } from "./views/OfficerDeskView";

const TUTORIAL_KEY = "ugov_tutorial_seen_v1";
const AppContent: React.FC = () => {
  const { activeTab, isAuthenticated, isLoadingAuth } = useGov();
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(false);
  useEffect(() => {
    if (isAuthenticated && !isLoadingAuth && !tutorialDone) {
      const seen = sessionStorage.getItem(TUTORIAL_KEY);
      if (!seen) { const t = setTimeout(() => setShowTutorial(true), 600); return () => clearTimeout(t); }
    }
  }, [isAuthenticated, isLoadingAuth, tutorialDone]);
  const completeTutorial = () => {
    sessionStorage.setItem(TUTORIAL_KEY, "1"); setShowTutorial(false); setTutorialDone(true);
    fetch("/api/v1/preferences", { method:"PATCH", credentials:"include", headers:{"Content-Type":"application/json"}, body:JSON.stringify({tutorialSeen:true}) }).catch(() => {});
  };
  const skipTutorial = () => { sessionStorage.setItem(TUTORIAL_KEY,"1"); setShowTutorial(false); setTutorialDone(true); };
  const renderView = () => {
    if (!isAuthenticated) return <AuthView />;
    switch (activeTab) {
      case "home": return <HomeView />;
      case "services": return <ServicesView />;
      case "dashboard": return <DashboardView />;
      case "documents": return <DocumentsView />;
      case "tracker": return <TrackerView />;
      case "consent": return <ConsentCenterView />;
      case "notifications": return <NotificationsView />;
      case "faq": return <FAQView />;
      case "mydata": return <MyDataView />;
      case "grievance": return <GrievanceView />;
      case "whereami": return <WhereAmIView />;
      case "officer": return <OfficerDeskView />;
      case "audit": return <AuditView />;
      case "admin": return <AdminView />;
      case "auth": return <AuthView />;
      default: return <HomeView />;
    }
  };
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#101828]">
      <Header />
      {isAuthenticated && <Navbar />}
      <main className={`flex-1 w-full mx-auto ${activeTab === "home" && isAuthenticated ? "max-w-none px-0 pt-[132px] pb-0" : "max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-[132px] pb-12"} ${!isAuthenticated ? "pt-24 pb-12" : ""}`}>
        {renderView()}
      </main>
      <Footer />
      <FloatingGBot /><GBotModal /><ExplainModal /><ServiceDetailsModal /><ApplicationWorkflowModal />
      {isAuthenticated && <MobileNav />}
      {showTutorial && <OnboardingTutorial onComplete={completeTutorial} onSkip={skipTutorial} />}
    </div>
  );
};
export function App() { return <GovProvider><NotificationProvider><AppContent /></NotificationProvider></GovProvider>; }
export default App;

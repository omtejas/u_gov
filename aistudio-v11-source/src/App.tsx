import React, { Suspense, lazy, useState, useEffect } from "react";
import { GovProvider, useGov } from "./context/GovContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { testConnection } from "./lib/firebase";
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

const HomeView = lazy(() => import("./views/HomeView").then((m) => ({ default: m.HomeView })));
const ServicesView = lazy(() => import("./views/ServicesView").then((m) => ({ default: m.ServicesView })));
const DashboardView = lazy(() => import("./views/DashboardView").then((m) => ({ default: m.DashboardView })));
const DocumentsView = lazy(() => import("./views/DocumentsView").then((m) => ({ default: m.DocumentsView })));
const TrackerView = lazy(() => import("./views/TrackerView").then((m) => ({ default: m.TrackerView })));
const AuthView = lazy(() => import("./views/AuthView").then((m) => ({ default: m.AuthView })));
const GrievanceView = lazy(() => import("./views/GrievanceView").then((m) => ({ default: m.GrievanceView })));
const AuditView = lazy(() => import("./views/AuditView").then((m) => ({ default: m.AuditView })));
const AdminView = lazy(() => import("./views/AdminView").then((m) => ({ default: m.AdminView })));
const ConsentCenterView = lazy(() => import("./views/ConsentCenterView").then((m) => ({ default: m.ConsentCenterView })));
const NotificationsView = lazy(() => import("./views/NotificationsView").then((m) => ({ default: m.NotificationsView })));
const FAQView = lazy(() => import("./views/FAQView").then((m) => ({ default: m.FAQView })));
const MyDataView = lazy(() => import("./views/MyDataView").then((m) => ({ default: m.MyDataView })));
const WhereAmIView = lazy(() => import("./views/WhereAmIView").then((m) => ({ default: m.WhereAmIView })));
const OfficerDeskView = lazy(() => import("./views/OfficerDeskView").then((m) => ({ default: m.OfficerDeskView })));
const WebHubView = lazy(() => import("./views/WebHubView").then((m) => ({ default: m.WebHubView })));
const ProfileView = lazy(() => import("./views/ProfileView").then((m) => ({ default: m.ProfileView })));

const TUTORIAL_KEY = "ugov_tutorial_seen_v1";

const ViewFallback: React.FC = () => (
  <div className="max-w-[1440px] mx-auto py-16 px-4 text-center text-xs font-semibold text-slate-500">
    Loading U-GOV workspace module...
  </div>
);

const AppContent: React.FC = () => {
  const { activeTab, isAuthenticated, isLoadingAuth } = useGov();
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(false);

  useEffect(() => {
    void testConnection();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isLoadingAuth && !tutorialDone) {
      const seen = sessionStorage.getItem(TUTORIAL_KEY);
      if (!seen) {
        const t = setTimeout(() => setShowTutorial(true), 600);
        return () => clearTimeout(t);
      }
    }
  }, [isAuthenticated, isLoadingAuth, tutorialDone]);

  const completeTutorial = () => {
    sessionStorage.setItem(TUTORIAL_KEY, "1");
    setShowTutorial(false);
    setTutorialDone(true);
    fetch("/api/v1/preferences", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tutorialSeen: true }),
    }).catch(() => {});
  };

  const skipTutorial = () => {
    sessionStorage.setItem(TUTORIAL_KEY, "1");
    setShowTutorial(false);
    setTutorialDone(true);
  };

  const renderView = () => {
    if (!isAuthenticated) return <AuthView />;
    switch (activeTab) {
      case "home":
        return <HomeView />;
      case "services":
        return <ServicesView />;
      case "webhub":
        return <WebHubView />;
      case "dashboard":
        return <DashboardView />;
      case "documents":
        return <DocumentsView />;
      case "tracker":
        return <TrackerView />;
      case "consent":
        return <ConsentCenterView />;
      case "notifications":
        return <NotificationsView />;
      case "faq":
        return <FAQView />;
      case "mydata":
        return <MyDataView />;
      case "profile":
        return <ProfileView />;
      case "grievance":
        return <GrievanceView />;
      case "whereami":
        return <WhereAmIView />;
      case "officer":
        return <OfficerDeskView />;
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
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] text-[#101828]">
      <Header />
      {isAuthenticated && <Navbar />}
      <main
        className={`flex-1 w-full mx-auto ${
          activeTab === "home" && isAuthenticated
            ? "max-w-none px-0 pt-[128px] pb-20 md:pb-0"
            : "max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-[128px] pb-24 md:pb-12"
        } ${!isAuthenticated ? "pt-24 pb-12" : ""}`}
      >
        <Suspense fallback={<ViewFallback />}>{renderView()}</Suspense>
      </main>
      <Footer />
      <FloatingGBot />
      <GBotModal />
      <ExplainModal />
      <ServiceDetailsModal />
      <ApplicationWorkflowModal />
      {isAuthenticated && <MobileNav />}
      {showTutorial && <OnboardingTutorial onComplete={completeTutorial} onSkip={skipTutorial} />}
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <GovProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </GovProvider>
    </ErrorBoundary>
  );
}

export default App;

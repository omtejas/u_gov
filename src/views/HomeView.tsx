import React from "react";
import { useGov } from "../context/GovContext";
import { Search, Sparkles, ShieldCheck, FolderLock, Activity, ArrowRight, GraduationCap, Sprout, Car, HeartPulse, Landmark, Building2, FileCheck2, Globe2, Fingerprint, ClipboardList, BellRing, LockKeyhole, ChevronRight, MoveUpRight, Network, BadgeCheck } from "lucide-react";

export const HomeView: React.FC = () => {
  const { services, openServiceModal, setActiveTab, openGBot, setSearchQuery } = useGov();
  const featuredServices = services.filter((s) => s.featured || s.isPopular).slice(0, 3);
  const categories = [
    { id: "education", label: "Education & scholarships", detail: "Learning, grants and student support", icon: GraduationCap, tone: "blue" },
    { id: "agriculture", label: "Farmers & agriculture", detail: "Farming, income and rural support", icon: Sprout, tone: "green" },
    { id: "transport", label: "Transport & driving", detail: "Licences, vehicles and mobility", icon: Car, tone: "yellow" },
    { id: "healthcare", label: "Health & wellbeing", detail: "Health cover and public care", icon: HeartPulse, tone: "red" },
    { id: "welfare", label: "Certificates & welfare", detail: "Identity, residence and benefits", icon: Landmark, tone: "blue" },
    { id: "housing", label: "Housing & homes", detail: "Housing and essential utilities", icon: Building2, tone: "green" },
  ];
  const quickActions = [
    { title: "Find a service", text: "Explore schemes and public services.", icon: Search, action: () => setActiveTab("services"), number: "01" },
    { title: "Track an application", text: "Follow progress and pending actions.", icon: Activity, action: () => setActiveTab("tracker"), number: "02" },
    { title: "Your document vault", text: "Manage documents and sharing consent.", icon: FolderLock, action: () => setActiveTab("documents"), number: "03" },
  ];
  const searchServices = (value: string) => { setSearchQuery(value); setActiveTab("services"); };

  return (
    <div className="ugov-home">
      <section className="ugov-hero">
        <div className="ugov-hero-grid" aria-hidden="true" />
        <div className="ugov-hero-orbit ugov-orbit-one" aria-hidden="true" />
        <div className="ugov-hero-orbit ugov-orbit-two" aria-hidden="true" />
        <div className="ugov-hero-inner">
          <div className="ugov-hero-copy">
            <div className="ugov-eyebrow ugov-eyebrow-light"><span className="ugov-live-dot" /> THE CITIZEN-FIRST DIGITAL GATEWAY</div>
            <h1>Public services.<br /><span>One connected</span><br />experience.</h1>
            <p className="ugov-hero-lede">Less searching. Less paperwork. More progress. Find the services you need, understand every step, and keep your important work moving.</p>
            <div className="ugov-searchbar">
              <Search size={21} />
              <input aria-label="Search public services" placeholder="What do you need help with today?" onKeyDown={(e) => { if (e.key === "Enter") searchServices((e.target as HTMLInputElement).value); }} />
              <button onClick={() => setActiveTab("services")}>Explore services <ArrowRight size={17} /></button>
            </div>
            <button className="ugov-hero-assist" onClick={() => openGBot("Help me find the right government service.")}><Sparkles size={17} /> Not sure where to begin? Ask Bharat G-Bot <MoveUpRight size={15} /></button>
          </div>
          <div className="ugov-hero-art" aria-label="Illustration of connected citizen services">
            <div className="ugov-art-orbit orbit-a" /><div className="ugov-art-orbit orbit-b" />
            <div className="ugov-art-core"><div className="ugov-art-emblem"><img src="/logo.png" alt="U-GOV emblem" /></div><span>ONE INDIA</span><strong>ONE GATEWAY</strong><small>CONNECTED PUBLIC SERVICES</small></div>
            <div className="ugov-art-node node-top"><Fingerprint size={19} /><span>Identity</span></div>
            <div className="ugov-art-node node-right"><FileCheck2 size={19} /><span>Documents</span></div>
            <div className="ugov-art-node node-bottom"><Network size={19} /><span>Services</span></div>
            <div className="ugov-art-node node-left"><Activity size={19} /><span>Tracking</span></div>
            <div className="ugov-art-index">01 <i>/ 04</i></div>
          </div>
        </div>
        <div className="ugov-hero-bottom"><span>BUILT AROUND YOUR NEEDS</span><span>SECURE BY DESIGN <ShieldCheck size={14} /></span><span>ACCESSIBLE ACROSS INDIA</span></div>
      </section>

      <section className="ugov-intro-strip">
        <p>ONE PLACE FOR THE THINGS THAT MATTER.</p>
        <h2>Government, made<br className="sm:hidden" /> easier to navigate.</h2>
        <div className="ugov-intro-note">A single, connected starting point for discovering services, managing documents and following applications—designed around people, not departments.</div>
      </section>

      <section className="ugov-quick-grid" aria-label="Quick actions">
        {quickActions.map((item) => { const Icon = item.icon; return (
          <button key={item.number} onClick={item.action} className="ugov-quick-card">
            <span className="ugov-quick-number">{item.number}</span><span className="ugov-quick-icon"><Icon size={22} /></span>
            <strong>{item.title}</strong><p>{item.text}</p><span className="ugov-quick-link">Get started <MoveUpRight size={16} /></span>
          </button>
        ); })}
      </section>

      <section className="ugov-section ugov-category-section">
        <div className="ugov-section-heading"><div><span className="ugov-eyebrow">EXPLORE BY NEED</span><h2>Where can we<br />help you today?</h2></div><p>Start with what matters to you. Explore a topic and find the public services connected to it.</p></div>
        <div className="ugov-category-grid">
          {categories.map((cat, index) => { const Icon = cat.icon; return (
            <button key={cat.id} onClick={() => searchServices(cat.id)} className={`ugov-category-card tone-${cat.tone}`}>
              <span className="ugov-category-top"><span>0{index + 1}</span><MoveUpRight size={18} /></span><Icon size={29} strokeWidth={1.6} />
              <strong>{cat.label}</strong><small>{cat.detail}</small>
            </button>
          ); })}
        </div>
      </section>

      <section className="ugov-feature-band">
        <div className="ugov-feature-copy"><span className="ugov-eyebrow ugov-eyebrow-light">A MORE CONNECTED WAY FORWARD</span><h2>One account.<br /><em>Many possibilities.</em></h2><p>Keep your citizen journey organised—from understanding requirements to tracking progress—with tools designed to work together.</p><button onClick={() => setActiveTab("dashboard")}>Explore your workspace <ArrowRight size={17} /></button></div>
        <div className="ugov-feature-stack">
          <div className="ugov-feature-tile"><span className="tile-icon"><ShieldCheck /></span><div><small>U-IDENTITY</small><strong>A single citizen profile</strong><p>Your account and preferences in one place.</p></div><ChevronRight /></div>
          <div className="ugov-feature-tile"><span className="tile-icon"><FolderLock /></span><div><small>U-DOCS</small><strong>Your documents, in control</strong><p>Organise records and manage consent.</p></div><ChevronRight /></div>
          <div className="ugov-feature-tile"><span className="tile-icon"><ClipboardList /></span><div><small>U-TRACK</small><strong>Know what happens next</strong><p>See application progress and actions.</p></div><ChevronRight /></div>
        </div>
      </section>

      <section className="ugov-section ugov-services-section">
        <div className="ugov-section-heading"><div><span className="ugov-eyebrow">THE SERVICE DIRECTORY</span><h2>Useful services.<br />Clear next steps.</h2></div><button className="ugov-text-link" onClick={() => setActiveTab("services")}>View all services <ArrowRight size={17} /></button></div>
        <div className="ugov-featured-grid">
          {featuredServices.map((service, index) => (
            <button key={service.id} onClick={() => openServiceModal(service)} className={`ugov-service-card service-card-${index + 1}`}>
              <span className="ugov-service-index">0{index + 1} / FEATURED</span><span className="ugov-service-code">{service.shortCode}</span>
              <strong>{service.name}</strong><p>{service.description}</p>
              <span className="ugov-service-meta"><span>{service.slaDays} day estimate</span><span>{service.fee === 0 ? "No fee listed" : `₹${service.fee} listed`}</span></span>
              <span className="ugov-service-arrow"><MoveUpRight size={19} /></span>
            </button>
          ))}
        </div>
        <div className="ugov-prototype-note"><Globe2 size={16} /><span>U-GOV is a Smart India Hackathon prototype. Service listings, fees and timelines are illustrative and must be confirmed with the issuing department.</span></div>
      </section>

      <section className="ugov-closing-cta"><div><span className="ugov-eyebrow ugov-eyebrow-light">HERE WHEN YOU NEED A HAND</span><h2>Good guidance<br />changes everything.</h2><p>Tell Bharat G-Bot what you are trying to do. Get help navigating the U-GOV prototype and its service catalogue.</p><button onClick={() => openGBot()}>Talk to Bharat G-Bot <ArrowRight size={17} /></button></div><div className="ugov-cta-mark"><Sparkles size={42} /><span>G</span></div></section>
    </div>
  );
};

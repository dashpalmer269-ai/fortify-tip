"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import PerspectiveGrid from "@/components/PerspectiveGrid";
import StarfieldBackground from "@/components/StarfieldBackground";

const AnimatedSphere = dynamic(() => import("@/components/AnimatedSphere"), { ssr: false });

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

const TABS = [
  {
    id: "registry",
    label: "Registry",
    href: "/registry",
    color: "#8B5CF6",
    glowColor: "rgba(139,92,246,0.5)",
    bgColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.3)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "community",
    label: "Community",
    href: "/community",
    color: "#10B981",
    glowColor: "rgba(16,185,129,0.5)",
    bgColor: "rgba(16,185,129,0.08)",
    borderColor: "rgba(16,185,129,0.3)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "forums",
    label: "Forums",
    href: "/forums",
    color: "#F97316",
    glowColor: "rgba(249,115,22,0.5)",
    bgColor: "rgba(249,115,22,0.08)",
    borderColor: "rgba(249,115,22,0.3)",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("registry");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <StarfieldBackground />

      {/* Top navigation */}
      <div className="relative z-10 flex items-center justify-between p-5">
        <button
          className="glass-card rounded-xl p-2.5 text-white transition-all duration-200 hover:scale-105"
          style={{ boxShadow: "0 0 15px rgba(255,255,255,0.1)" }}
          aria-label="Home"
        >
          <HomeIcon />
        </button>

        <div className="flex-1 flex justify-center px-8">
          <h1
            className="text-lg font-bold tracking-[0.35em] text-white/80 uppercase"
            style={{ textShadow: "0 0 20px rgba(139,92,246,0.5)" }}
          >
            Fortify
          </h1>
        </div>

        <button
          className="glass-card rounded-xl p-2.5 text-white transition-all duration-200 hover:scale-105"
          aria-label="Toggle theme"
        >
          <MoonIcon />
        </button>
      </div>

      {/* Tab cards */}
      <div className="relative z-10 flex justify-center gap-4 px-6 mt-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); router.push(tab.href); }}
            className="glass-card rounded-2xl flex-1 max-w-[220px] p-5 flex flex-col items-center gap-3 cursor-pointer transition-all duration-300 group relative overflow-hidden"
            style={{
              borderColor: activeTab === tab.id ? tab.borderColor : "rgba(255,255,255,0.08)",
              boxShadow: activeTab === tab.id ? `0 0 25px ${tab.glowColor}, 0 0 50px ${tab.glowColor.replace("0.5","0.12")}` : undefined,
            }}
          >
            <div
              className="p-3 rounded-xl transition-all duration-300"
              style={{ background: tab.bgColor, boxShadow: activeTab === tab.id ? `0 0 15px ${tab.glowColor}` : undefined }}
            >
              {tab.icon}
            </div>
            <span className="text-white font-semibold tracking-wide text-sm">{tab.label}</span>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="h-full rounded-b-2xl transition-all duration-500"
                style={{
                  width: activeTab === tab.id ? "100%" : "0%",
                  background: `linear-gradient(90deg, transparent, ${tab.color}, transparent)`,
                  boxShadow: `0 0 8px ${tab.color}`,
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Main centerpiece */}
      <div className="relative z-10 flex flex-col items-center mt-6 px-4 w-full">
        <div className="relative flex flex-col items-center w-full max-w-[600px]">
          <AnimatedSphere />

          {/* Hero text overlay */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{ zIndex: 2 }}
          >
            <h2
              className="text-white font-medium text-center leading-tight"
              style={{
                fontSize: "clamp(28px,4vw,48px)",
                letterSpacing: "0.12em",
                textShadow: "0 0 30px rgba(139,92,246,0.8), 0 0 60px rgba(139,92,246,0.4), 0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              Fortify Your Defense
            </h2>
          </div>
        </div>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="w-full max-w-2xl -mt-4 relative z-10"
        >
          <div
            className="glass-card rounded-full flex items-center gap-3 px-5 py-3.5 transition-all duration-300"
            style={{ boxShadow: "0 0 0 1.5px rgba(139,92,246,0.65), 0 0 22px rgba(139,92,246,0.28)" }}
          >
            <span className="text-violet-400 flex-shrink-0"><SearchIcon /></span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Discover"
              maxLength={69}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-violet-300/60"
              onFocus={(e) => {
                (e.target.closest("div") as HTMLDivElement).style.boxShadow = "0 0 0 2px rgba(139,92,246,0.9), 0 0 32px rgba(139,92,246,0.45)";
              }}
              onBlur={(e) => {
                (e.target.closest("div") as HTMLDivElement).style.boxShadow = "0 0 0 1.5px rgba(139,92,246,0.65), 0 0 22px rgba(139,92,246,0.28)";
              }}
            />
            <button
              type="submit"
              className="text-violet-400 hover:text-violet-300 flex-shrink-0 transition-colors"
              title="AI Search"
            >
              <SparkleIcon />
            </button>
          </div>
        </form>
      </div>

      {/* Perspective grid floor */}
      <div className="relative z-0 mt-8">
        <PerspectiveGrid />
      </div>
    </div>
  );
}

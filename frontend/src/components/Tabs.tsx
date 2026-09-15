"use client";

interface TabsProps {
  tabs: { key: string; label: string; icon: string }[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1.5 p-2 mx-4 mt-3 rounded-2xl glass">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-medium transition-all duration-300 cursor-pointer group ${
            active === tab.key
              ? "bg-accent/12 text-accent border border-accent/25 shadow-[0_0_16px_rgba(52,211,153,0.08)]"
              : "text-dim hover:text-foreground hover:bg-white/[0.03]"
          }`}
        >
          <span className={`text-base transition-all duration-300 ${
            active === tab.key ? "scale-110 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" : "group-hover:scale-115 group-hover:rotate-[-8deg]"
          }`}>
            {tab.icon}
          </span>
          <span className="tracking-wide">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

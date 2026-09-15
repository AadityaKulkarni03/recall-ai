"use client";

interface TabsProps {
  tabs: { key: string; label: string; icon: string }[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 p-1.5 mx-4 mt-3 rounded-xl bg-surface-solid/50">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-300 cursor-pointer group ${
            active === tab.key
              ? "bg-accent/15 text-accent border border-accent/20 shadow-[0_0_12px_rgba(249,115,22,0.1)]"
              : "text-dim hover:text-foreground hover:bg-surface2"
          }`}
        >
          <span className={`text-sm transition-transform duration-300 ${
            active === tab.key ? "scale-110" : "group-hover:scale-110 group-hover:-rotate-6"
          }`}>
            {tab.icon}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

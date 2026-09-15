"use client";

interface TabsProps {
  tabs: { key: string; label: string; icon: string }[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 text-[11px] font-bold uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer border-b-2 ${
            active === tab.key
              ? "text-accent border-accent bg-accent/[0.03]"
              : "text-dim border-transparent hover:text-foreground hover:bg-white/[0.01]"
          }`}
        >
          <span className={`text-base transition-transform duration-300 ${
            active === tab.key ? "scale-110" : "group-hover:scale-110"
          }`}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

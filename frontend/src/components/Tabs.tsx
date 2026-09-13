"use client";

interface TabsProps {
  tabs: { key: string; label: string; icon: string }[];
  active: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-border bg-surface">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex-1 py-2.5 text-center text-sm cursor-pointer transition-all border-b-2 ${
            active === tab.key
              ? "text-accent border-accent bg-accent-dim"
              : "text-dim border-transparent hover:text-foreground"
          }`}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </div>
  );
}

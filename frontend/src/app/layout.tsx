import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recall — Meeting Memory",
  description: "Real-time meeting memory with instant semantic search powered by Moss",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Browser extensions commonly mutate <html>/<body> before React hydrates —
  // the swipe-navigation blockers inject `overscroll-behavior-x: none`, which
  // React then reports as a hydration mismatch. suppressHydrationWarning is
  // shallow: it covers only these two elements' own attributes, so genuine
  // mismatches inside the app are still reported.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

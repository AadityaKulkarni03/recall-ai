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
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

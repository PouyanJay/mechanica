import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engine Atlas | Seven Interactive Engines",
  description: "Explore seven turbine, piston and rotary engines in interactive 3D. Inspect components, reveal cutaways, and separate assemblies.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DDU Business Dashboard",
  description: "Personal weekly business dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devizo",
  description: "Devize profesionale mai rapide pentru companiile de renovări.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

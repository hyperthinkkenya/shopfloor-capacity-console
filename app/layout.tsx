import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopfloor Capacity Console",
  description:
    "Finite scheduling console for NetSuite work orders, machines, labour, and tooling.",
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
      <body>{children}</body>
    </html>
  );
}

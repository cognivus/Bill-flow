import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BillFlow — Smart Billing for Small Business",
  description:
    "Multi-tenant SaaS billing platform with GST invoicing, customer management, and real-time analytics.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} antialiased bg-slate-50 text-slate-900`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

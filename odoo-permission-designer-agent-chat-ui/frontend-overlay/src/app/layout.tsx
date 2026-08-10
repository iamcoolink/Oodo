import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { I18nProvider } from "@/i18n";

const inter = Inter({
  subsets: ["latin"],
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Odoo ERP",
  description: "Odoo Permission Designer",
  icons: {
    icon: "/icon1.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <I18nProvider>
          <NuqsAdapter>{children}</NuqsAdapter>
        </I18nProvider>
      </body>
    </html>
  );
}

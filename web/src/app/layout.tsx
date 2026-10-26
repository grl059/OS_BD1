import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kernel Data Structures",
  description:
    "F.CSM302 BD1 - Операцийн системийн кернел дотор ашиглагддаг 7 өгөгдлийн бүтцийг C кодоор бодитоор ажиллуулж, вэб дээр харуулах сургалтын хэрэгсэл.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

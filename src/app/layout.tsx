import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Airtable Clone",
  description: "An Airtable Clone built with T3 Stack",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable}`}>
        <body>
          <SignedIn>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </SignedIn>
          <SignedOut>
            <div className="flex min-h-screen items-center justify-center">
              <SignIn />
            </div>
          </SignedOut>
        </body>
      </html>
    </ClerkProvider>
  );
}

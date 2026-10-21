import { AuthProvider } from "@/components/providers/auth-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Poppins } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  subsets: ["latin"],
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Compliance Desk",
    template: "%s — Compliance Desk",
  },
  description: "Enterprise automated compliance management — analyze regulatory documents, evaluate checklists, and generate audit reports.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${poppins.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SessionProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

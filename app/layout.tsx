import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "2Menit Photobooth Kasir",
  description: "Aplikasi kasir & rekap keuangan photobooth.",
  icons: { icon: "/simple-logo-2menit.png" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "2Menit Kasir",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set the theme class before first paint to avoid a flash (FOUC).
  const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

  // Old Safari (iOS 12) defaults fetch to credentials:"omit", so next-auth's signIn() never keeps
  // the CSRF/session cookies and login silently bounces. Give fetch the modern default.
  const fetchCredentialsFix = `(function(){var f=window.fetch;if(!f)return;window.fetch=function(input,init){var isReq=typeof Request!=='undefined'&&input instanceof Request;if(!isReq&&!(init&&init.credentials)){init=Object.assign({},init,{credentials:'same-origin'});}return f.call(this,input,init);};})();`;

  return (
    <html
      lang="id"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: fetchCredentialsFix }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
        <Toaster position="top-center" richColors closeButton theme="system" />
      </body>
    </html>
  );
}

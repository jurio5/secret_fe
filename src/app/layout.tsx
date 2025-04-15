import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { ToastProvider } from "@/contexts/ToastContext";
import { Toaster } from 'react-hot-toast';

const pretendard = localFont({
  src: "./../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "Quizzle",
  description: "퀴즐 - 지식을 테스트하고 새로운 것을 배워보세요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full`}>
      <body className={`${pretendard.className} antialiased min-h-screen w-full overflow-x-hidden flex flex-col`}>
        <ToastProvider>
          {children}
        </ToastProvider>
        <Toaster
          position="top-center"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 2000,
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '10px',
              padding: '16px'
            },
            success: {
              iconTheme: {
                primary: '#4caf50',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#e53935',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}

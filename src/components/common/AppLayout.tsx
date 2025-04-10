import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";

interface AppLayoutProps {
  children: ReactNode;
  showHomeButton?: boolean;
}

export default function AppLayout({ children, showHomeButton = true }: AppLayoutProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-br from-blue-800/30 to-indigo-800/20 rounded-full blur-3xl transform translate-x-1/4 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-2/3 h-2/3 bg-gradient-to-tr from-indigo-800/20 to-blue-800/20 rounded-full blur-3xl transform -translate-x-1/4 translate-y-1/4" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header showHomeButton={showHomeButton} />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
} 
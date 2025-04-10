import Link from "next/link";

interface HeaderProps {
  showHomeButton?: boolean;
}

export default function Header({ showHomeButton = true }: HeaderProps) {
  return (
    <header className="sticky top-0 bg-gray-900/70 backdrop-blur-md py-4 px-6 shadow-md border-b border-gray-800">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 text-transparent bg-clip-text">Quizzle</h1>
        </Link>
        {showHomeButton && (
          <Link href="/">
            <button className="text-white hover:text-blue-300 px-4 py-2 rounded-full text-sm transition-colors">
              홈으로
            </button>
          </Link>
        )}
      </div>
    </header>
  );
} 
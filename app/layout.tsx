import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Home Dashboard",
  description: "Local-only dashboard for home services"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <nav className="tabs" aria-label="Main navigation">
            <Link href="/">Home</Link>
            <Link href="/news">News</Link>
            <Link href="/shop">Shop</Link>
            <Link href="/budget">Budget</Link>
          </nav>

          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

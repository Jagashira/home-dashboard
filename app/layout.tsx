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
          <header className="topbar">
            <div>
              <p className="eyebrow">LOCAL NETWORK DASHBOARD</p>
              <h1 className="brand">Home Dashboard</h1>
            </div>
            <p className="topbar-note">LAN / Tailscale only</p>
          </header>

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

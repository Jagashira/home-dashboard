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
        <nav>
          <Link href="/">Home</Link>
          <Link href="/news">News</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/budget">Budget</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

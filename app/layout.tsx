import "./globals.css";
import "./organizer.css";

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
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

import "../globals.css";

export const metadata = {
  title: "Pickle Pathway Admin",
};

export default function AdminLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-white text-slate-800">
        {/* Intentionally no <Nav/> here. Add your admin topbar if you want. */}
        {children}
      </body>
    </html>
  );
}

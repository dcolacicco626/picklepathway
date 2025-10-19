import "./globals.css";
import Nav from "./components/Nav";

export const metadata = {
  title: "Pickle Pathway",
  description: "Run pickleball leagues effortlessly with automated tools.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#f7fbf8] text-slate-800">
        <Nav />          {/* ✅ header now appears globally */}
        {children}
      </body>
    </html>
  );
}

import "../globals.css";
import Nav from "../components/Nav";

export const metadata = {
  title: "Pickle Pathway",
  description: "Run pickleball leagues effortlessly.",
};

export default function SiteLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#f7fbf8] text-slate-800">
        <Nav /> {/* sticky header lives here for all marketing pages */}
        {children}
      </body>
    </html>
  );
}

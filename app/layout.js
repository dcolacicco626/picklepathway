// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Pickle Pathway",
  description: "Run pickleball leagues effortlessly.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#f7fbf8] text-slate-800">{children}</body>
    </html>
  );
}

// app/layout.js


export const metadata = {
  title: "Pickle Pathway",
  description: "Pickleball leagues and ladders management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

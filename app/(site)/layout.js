import Nav from "@/components/Nav"; // alias is safest

export const metadata = {
  title: "Pickle Pathway – League Software",
};

export default function SiteLayout({ children }) {
  return (
    <>
      <Nav />   {/* sticky header lives here */}
      {children}
    </>
  );
}

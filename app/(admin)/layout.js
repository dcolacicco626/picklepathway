// app/(admin)/layout.js
export const metadata = { title: "Pickle Pathway Admin" };

import ActiveOrgBoot from "./_components/ActiveOrgBoot";

export default function AdminLayout({ children }) {
  // Bootstraps org_id cookie on first load after login
  return (
    <>
      <ActiveOrgBoot />
      {children}
    </>
  );
}

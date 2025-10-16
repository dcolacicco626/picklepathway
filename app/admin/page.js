// /app/admin/page.js
export const dynamic = "force-dynamic";

export default async function AdminSmokeTest() {
  return (
    <div style={{padding:24, fontFamily:"system-ui"}}>
      <h1>/admin is reachable ✅</h1>
      <p>If you can see this, middleware is not blocking /admin. Next we’ll re-enable Supabase.</p>
    </div>
  );
}

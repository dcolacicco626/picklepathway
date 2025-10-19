cat > app/api/_health/route.js <<'EOF'
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return new Response(JSON.stringify({ ok: true, t: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
}
EOF

// lib/emailRenderer.js
export async function fetchTemplate(leagueId, phase) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/email_templates?select=*&league_id=eq.${leagueId}&phase=eq.${phase}`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    }
  );
  const data = await res.json();
  return data?.[0] || null;
}

export function renderTemplate(subjectTemplate, htmlTemplate, vars = {}) {
  const render = (tpl) =>
    tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  return {
    subject: render(subjectTemplate),
    html: render(htmlTemplate),
  };
}

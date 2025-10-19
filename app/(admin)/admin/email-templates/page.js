"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

/** Brand styles */
const brand = {
  card: "bg-white shadow-sm rounded-2xl",
  ring: "ring-1 ring-slate-200",
  border: "border border-slate-200",
  cta: "bg-[#0ea568] text-white",
  ctaOutline: "border border-[#0ea568] text-[#0ea568] hover:bg-[#e9f7f0]",
  subtext: "text-slate-600",
};

/** Canonical tokens (DB) */
const TOKEN_KEYS = [
  "{{firstName}}",
  "{{league_title}}",
  "{{week}}",
  "{{wk_label}}",
  "{{player_portal_url}}",
  "{{assignments_table}}",
];

/** Aliases shown in UI */
const TOKEN_ALIASES = {
  "{{week}}": "{{week #}}",
  "{{wk_label}}": "{{wk_date}}",
};

/** Helper mappers */
const LABEL_BY_KEY = (key) => TOKEN_ALIASES[key] ?? key;
const KEY_BY_LABEL = (() => {
  const rev = {};
  Object.entries(TOKEN_ALIASES).forEach(([k, v]) => (rev[v] = k));
  return (label) => rev[label] ?? label;
})();

/** Display aliases */
function aliasize(str) {
  if (!str) return str;
  let out = str;
  for (const [k, v] of Object.entries(TOKEN_ALIASES)) out = out.split(k).join(v);
  return out;
}

/** Store canonical */
function canonicalize(str) {
  if (!str) return str;
  let out = str;
  const pairs = Object.entries(TOKEN_ALIASES).map(([k, v]) => [v, k]);
  for (const [label, key] of pairs) out = out.split(label).join(key);
  return out;
}

const TOKENS_UI = TOKEN_KEYS.map((key) => ({
  key,
  label: LABEL_BY_KEY(key),
}));

/** Font sizes */
const SIZE_STEPS = [12, 14, 16, 18, 20, 24, 28];
function pxToExecSize(px) {
  const i = Math.max(0, SIZE_STEPS.findIndex((v) => v >= px));
  return Math.min(7, i + 1) || 3;
}
function execSizeToPx(n) {
  const idx = Math.min(Math.max(1, Number(n)), 7) - 1;
  return SIZE_STEPS[idx] ?? 16;
}

export default function EmailTemplatesPage() {
  const [phase, setPhase] = useState("intro");
  const [subjectAlias, setSubjectAlias] = useState("");
  const [htmlAlias, setHtmlAlias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTarget, setActiveTarget] = useState("body");

  // Link modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const savedRangeRef = useRef(null);
  const usingControlRef = useRef(false);

  /** Selection handling */
// Add anywhere above saveTemplate (e.g., near other helpers)
function cleanHeadingLeaks(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  temp.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    const toMove = [];
    h.childNodes.forEach((n) => {
      if (
        n.nodeType === 1 &&
        /^(P|DIV|TABLE|TBODY|TR|TD|UL|OL|LI|HR)$/i.test(n.tagName)
      ) {
        toMove.push(n);
      }
    });
    toMove.forEach((el) => h.parentNode.insertBefore(el, h.nextSibling));
  });
  return temp.innerHTML;
}

  function rangeIsInside(el, range) {
    if (!el || !range) return false;
    const c = range.commonAncestorContainer;
    return el === c || (c && el.contains(c));
  }
  function saveSelection(force = false) {
    if (usingControlRef.current && !force) return;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (force || rangeIsInside(bodyRef.current, r)) savedRangeRef.current = r.cloneRange();
  }
  function restoreSelection() {
    const sel = window.getSelection?.();
    const r = savedRangeRef.current;
    if (!sel || !r) return;
    sel.removeAllRanges();
    sel.addRange(r);
  }

  useEffect(() => {
    const onSelChange = () => saveSelection();
    document.addEventListener("selectionchange", onSelChange);
    return () => document.removeEventListener("selectionchange", onSelChange);
  }, []);

  /** Load + save Supabase */
  async function loadTemplate() {
    setLoading(true);
    try {
      const { data: row, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("phase", phase)
        .is("league_id", null)
        .maybeSingle();

      if (error) throw error;
      setSubjectAlias(aliasize(row?.subject_template || ""));
      setHtmlAlias(aliasize(row?.html_template || ""));
      if (bodyRef.current) {
        bodyRef.current.innerHTML =
          row?.html_template || `<p>Hey {{firstName}},</p><p>See you on {{wk_date}}!</p>`;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplate();
  }, [phase]);

  async function saveTemplate() {
    setSaving(true);
const cleanedHtml = cleanHeadingLeaks(htmlAlias);
    try {
      const payload = {
        league_id: null,
        phase,
        subject_template: canonicalize(subjectAlias),
        html_template: canonicalize(cleanedHtml),
      };
      const { error } = await supabase
        .from("email_templates")
        .upsert(payload, { onConflict: "league_id,phase" });
      if (error) throw error;
      alert("Saved!");
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function onBodyInput() {
    const v = bodyRef.current?.innerHTML || "";
    setHtmlAlias(v);
  }
  function exec(cmd, value = null) {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, value);
    onBodyInput();
    saveSelection(true);
  }

  function applyFontSize(px) {
    if (!bodyRef.current) return;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    let range = savedRangeRef.current ?? sel.getRangeAt(0);
    if (!rangeIsInside(bodyRef.current, range)) {
      bodyRef.current.focus();
      range = document.createRange();
      range.selectNodeContents(bodyRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const step = pxToExecSize(px);
    document.execCommand("fontSize", false, String(step));
    onBodyInput();
    saveSelection(true);
  }

  function insertAtCaretInInput(inputEl, text) {
    const start = inputEl.selectionStart ?? inputEl.value.length;
    const end = inputEl.selectionEnd ?? inputEl.value.length;
    const next = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
    inputEl.value = next;
    inputEl.focus();
    const pos = start + text.length;
    inputEl.setSelectionRange(pos, pos);
    setSubjectAlias(next);
  }

  function insertTextAtCaret(text) {
    const sel = window.getSelection?.();
    let r = savedRangeRef.current || (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
    if (!r || !rangeIsInside(bodyRef.current, r)) {
      bodyRef.current.focus();
      r = document.createRange();
      r.selectNodeContents(bodyRef.current);
      r.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
    const node = document.createTextNode(text);
    r.deleteContents();
    r.insertNode(node);
    r.setStartAfter(node);
    r.setEndAfter(node);
    sel?.removeAllRanges();
    sel?.addRange(r);
    onBodyInput();
    saveSelection(true);
  }

  function handleTokenClick(tokenKey) {
    const label = LABEL_BY_KEY(tokenKey);
    if (activeTarget === "subject") {
      if (subjectRef.current) insertAtCaretInInput(subjectRef.current, label);
    } else {
      insertTextAtCaret(label);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7fbf8] text-slate-800">
      <main className="container mx-auto px-6 py-16">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Email Templates</h1>
            <div className="flex gap-3">
              <Link href="/" className={`px-4 py-2 rounded-xl ${brand.ctaOutline}`}>
                Home
              </Link>
              <button
                onClick={saveTemplate}
                disabled={saving || loading}
                className={`px-4 py-2 rounded-xl ${brand.cta} disabled:opacity-60`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <section className={`${brand.card} ${brand.ring} p-6`}>
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <div className="font-medium">Global League Template Email</div>
              <div>
                <label className={`${brand.subtext} text-sm mb-1`}>Phase</label>
                <select
                  className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  disabled={loading}
                >
                  <option value="intro">Welcome (Week 1)</option>
                  <option value="weekly">Weekly (Weeks 2–6)</option>
                </select>
              </div>
            </div>

            {/* Subject */}
            <div className="mt-5">
              <label className={`${brand.subtext} text-sm mb-1 block`}>Subject</label>
              <input
                ref={subjectRef}
                onFocus={() => setActiveTarget("subject")}
                className={`w-full px-3 py-2 rounded-xl ${brand.border}`}
                value={subjectAlias}
                onChange={(e) => setSubjectAlias(e.target.value)}
                placeholder="e.g., [Week {{week #}}] Pickle Pathway — {{league_title}} — assignments & info"
              />
            </div>
          </section>

          <section className={`${brand.card} ${brand.ring} p-6`}>
            <label className={`${brand.subtext} text-sm mb-2 block`}>Body</label>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                className={`px-2 py-1 rounded-lg ${brand.border}`}
                title="Font size"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!val) return;
                  applyFontSize(val);
                  e.currentTarget.selectedIndex = 0;
                }}
              >
                <option value="">Font size…</option>
                {SIZE_STEPS.map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>
              <button
                className={`px-2 py-1 rounded-lg ${brand.border}`}
                onClick={() => exec("bold")}
              >
                <span className="font-bold">B</span>
              </button>
              <button
                className={`px-2 py-1 rounded-lg ${brand.border}`}
                onClick={() => exec("italic")}
              >
                <span className="italic">I</span>
              </button>
              <button
                className={`px-2 py-1 rounded-lg ${brand.border}`}
                onClick={() => exec("underline")}
              >
                <span className="underline">U</span>
              </button>
            </div>

            <div
              ref={bodyRef}
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveTarget("body")}
              onInput={onBodyInput}
              onKeyUp={() => saveSelection(true)}
              onMouseUp={() => saveSelection(true)}
              className={`min-h-[260px] px-3 py-2 rounded-xl ${brand.border} bg-white`}
              style={{ outline: "none", lineHeight: "1.5" }}
            />

            <p className="text-xs text-slate-500 mt-2">
              Click any token below to insert at the cursor (aliases shown).
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {TOKENS_UI.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className="text-xs px-2 py-1 rounded-full border border-slate-300 hover:bg-slate-50"
                  onClick={() => handleTokenClick(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

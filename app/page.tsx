"use client";

import React, { useEffect, useMemo, useState } from "react";

type ApiFlag = { type: "LOW" | "MEDIUM" | "HIGH"; msg: string };
type ApiResult = {
  emi: number;
  total_payable: number;
  total_interest: number;
  effective_apr: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  flags: ApiFlag[];
};

type LoanForm = {
  principal: number;
  annual_interest_rate: number;
  tenure_months: number;
  processing_fee: number;
  monthly_income: number;
  existing_emi: number;
};

type SavedScenario = {
  id: string;
  label: string;
  createdAt: string;
  form: LoanForm;
  result: ApiResult;
};

const API_BASE = "http://127.0.0.1:8000";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtINR(n: number) {
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${Math.round(n)}`;
  }
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

function ratioPct(num: number, den: number) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return (num / den) * 100;
}

function safeId(prefix = "LL") {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${day}-${s}`;
}

// ✅ theme-aware risk pill styles (fixes low-contrast in light mode)
function riskPillCls(r: ApiResult["risk"], theme: "light" | "dark") {
  if (theme === "dark") {
    if (r === "LOW") return "bg-emerald-600/15 text-emerald-200 border-emerald-500/30";
    if (r === "MEDIUM") return "bg-amber-600/15 text-amber-100 border-amber-500/30";
    return "bg-rose-600/15 text-rose-100 border-rose-500/30";
  }
  if (r === "LOW") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (r === "MEDIUM") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-rose-50 text-rose-800 border-rose-200";
}

function riskDotCls(r: ApiResult["risk"]) {
  if (r === "LOW") return "bg-emerald-500";
  if (r === "MEDIUM") return "bg-amber-500";
  return "bg-rose-500";
}

// ✅ theme-aware flag chips (fixes “flags not visible in white mode”)
function flagChip(flag: ApiFlag, theme: "light" | "dark") {
  if (theme === "dark") {
    if (flag.type === "LOW") return "bg-emerald-500/10 border-emerald-500/20 text-emerald-100";
    if (flag.type === "MEDIUM") return "bg-amber-500/10 border-amber-500/20 text-amber-100";
    return "bg-rose-500/10 border-rose-500/20 text-rose-100";
  }
  if (flag.type === "LOW") return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (flag.type === "MEDIUM") return "bg-amber-50 border-amber-200 text-amber-800";
  return "bg-rose-50 border-rose-200 text-rose-800";
}

function badgeForDTI(dti: number) {
  if (dti <= 30) return { label: "Healthy", cls: "bg-emerald-600/15 text-emerald-200 border-emerald-500/30" };
  if (dti <= 45) return { label: "Watch", cls: "bg-amber-600/15 text-amber-100 border-amber-500/30" };
  return { label: "Stressed", cls: "bg-rose-600/15 text-rose-100 border-rose-500/30" };
}

function Field({
  label,
  value,
  onChange,
  theme,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  theme: "light" | "dark";
  help?: string;
}) {
  const inputBase =
    "w-full rounded-xl border px-3 py-2 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-sky-500/40";
  const inputCls =
    theme === "dark"
      ? `${inputBase} bg-black/30 border-white/10 text-slate-100 placeholder:text-slate-500`
      : `${inputBase} bg-white border-slate-200 text-slate-900 placeholder:text-slate-400`;

  const labelCls = theme === "dark" ? "text-slate-200" : "text-slate-800";
  const helpCls = theme === "dark" ? "text-slate-400" : "text-slate-500";

  return (
    <label className="block">
      <div className={`text-xs font-semibold ${labelCls}`}>{label}</div>
      <input
        className={inputCls}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {help ? <div className={`mt-1 text-[11px] ${helpCls}`}>{help}</div> : null}
    </label>
  );
}

function MiniBar({
  label,
  value,
  max,
  theme,
}: {
  label: string;
  value: number;
  max: number;
  theme: "light" | "dark";
}) {
  const pct = clamp((max <= 0 ? 0 : (value / max) * 100), 0, 100);
  const track = theme === "dark" ? "bg-white/10" : "bg-slate-200";
  const fill = theme === "dark" ? "bg-sky-400/80" : "bg-sky-600";
  const text = theme === "dark" ? "text-slate-200" : "text-slate-700";
  return (
    <div className="space-y-1">
      <div className={`flex items-center justify-between text-[11px] ${text}`}>
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{fmtINR(value)}</span>
      </div>
      <div className={`h-2 w-full rounded-full ${track}`}>
        <div className={`h-2 rounded-full ${fill} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function KPI({
  title,
  value,
  subtitle,
  theme,
  right,
}: {
  title: string;
  value: string;
  subtitle?: string;
  theme: "light" | "dark";
  right?: React.ReactNode;
}) {
  const card =
    theme === "dark"
      ? "border-white/10 bg-white/5 hover:bg-white/7"
      : "border-slate-200 bg-white hover:bg-slate-50";
  const muted = theme === "dark" ? "text-slate-400" : "text-slate-500";
  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl ${card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`text-[11px] font-semibold ${muted}`}>{title}</div>
          <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
          {subtitle ? <div className={`mt-1 text-[11px] ${muted}`}>{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

function GlossaryItem({
  title,
  body,
  theme,
}: {
  title: string;
  body: string;
  theme: "light" | "dark";
}) {
  const box = theme === "dark" ? "border-white/10 bg-white/5" : "border-slate-200 bg-white";
  const muted = theme === "dark" ? "text-slate-300" : "text-slate-700";
  const sub = theme === "dark" ? "text-slate-400" : "text-slate-500";
  return (
    <details className={`rounded-xl border p-3 ${box}`}>
      <summary className={`cursor-pointer select-none text-sm font-semibold ${muted}`}>{title}</summary>
      <div className={`mt-2 text-sm leading-relaxed ${sub}`}>{body}</div>
    </details>
  );
}

/** Risk Trend Gauge: 0..100 */
function RiskGauge({
  value,
  label,
  theme,
  hint,
}: {
  value: number;
  label: string;
  theme: "light" | "dark";
  hint?: string;
}) {
  const v = clamp(value, 0, 100);

  const color =
    v <= 35
      ? "conic-gradient(#34d399 0deg, #34d399 var(--deg), rgba(255,255,255,0.08) var(--deg), rgba(255,255,255,0.08) 360deg)"
      : v <= 60
      ? "conic-gradient(#fbbf24 0deg, #fbbf24 var(--deg), rgba(255,255,255,0.08) var(--deg), rgba(255,255,255,0.08) 360deg)"
      : "conic-gradient(#fb7185 0deg, #fb7185 var(--deg), rgba(255,255,255,0.08) var(--deg), rgba(255,255,255,0.08) 360deg)";

  const ringBg = theme === "dark" ? "bg-black/30 border-white/10" : "bg-white border-slate-200";
  const text = theme === "dark" ? "text-slate-100" : "text-slate-900";
  const muted = theme === "dark" ? "text-slate-400" : "text-slate-500";

  const deg = `${Math.round((v / 100) * 360)}deg`;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative h-16 w-16 rounded-full border ${ringBg}`}
        style={
          {
            "--deg": deg,
            backgroundImage: color,
          } as React.CSSProperties
        }
        title={hint || ""}
      >
        <div className={`absolute inset-[6px] rounded-full ${theme === "dark" ? "bg-slate-950" : "bg-white"}`} />
        <div className="absolute inset-0 grid place-items-center">
          <div className={`text-[13px] font-extrabold tabular-nums ${text}`}>{Math.round(v)}</div>
        </div>
      </div>
      <div className={`mt-1 text-[10px] font-semibold ${muted}`}>{label}</div>
    </div>
  );
}

function DemoHint({
  title,
  body,
  theme,
  icon,
}: {
  title: string;
  body: string;
  theme: "light" | "dark";
  icon?: string;
}) {
  const box =
    theme === "dark"
      ? "border-sky-500/25 bg-sky-500/10 text-slate-100"
      : "border-sky-200 bg-sky-50 text-slate-900";
  const muted = theme === "dark" ? "text-slate-300" : "text-slate-600";
  return (
    <div className={`rounded-2xl border p-3 ${box} anim-fadeUp`}>
      <div className="flex items-start gap-2">
        <div className="mt-[2px] text-lg">{icon || "💡"}</div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className={`mt-1 text-sm leading-relaxed ${muted}`}>{body}</div>
        </div>
      </div>
    </div>
  );
}

export default function Page(): React.JSX.Element {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [activePage, setActivePage] = useState<"Dashboard" | "Reports" | "Compare" | "Settings">("Dashboard");

  const [demoMode, setDemoMode] = useState(true);

  const [reportId, setReportId] = useState("");
  const [reportTime, setReportTime] = useState("");

  const [resultAnimKey, setResultAnimKey] = useState(0);
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    setReportId(safeId());
    const d = new Date();
    setReportTime(
      d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const baseA: LoanForm = {
    principal: 50000,
    annual_interest_rate: 24,
    tenure_months: 12,
    processing_fee: 2000,
    monthly_income: 25000,
    existing_emi: 4000,
  };

  const baseB: LoanForm = {
    principal: 80000,
    annual_interest_rate: 18,
    tenure_months: 24,
    processing_fee: 1000,
    monthly_income: 35000,
    existing_emi: 6000,
  };

  const [formA, setFormA] = useState<LoanForm>(baseA);
  const [formB, setFormB] = useState<LoanForm>(baseB);

  const [resA, setResA] = useState<ApiResult | null>(null);
  const [resB, setResB] = useState<ApiResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorA, setErrorA] = useState("");
  const [errorB, setErrorB] = useState("");

  const [saved, setSaved] = useState<SavedScenario[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("loanlens_saved_console");
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);

  function persistSaved(next: SavedScenario[]) {
    setSaved(next);
    try {
      localStorage.setItem("loanlens_saved_console", JSON.stringify(next.slice(0, 8)));
    } catch {}
  }

  const derivedA = useMemo(() => {
    const emi = resA?.emi ?? 0;
    const totalEmi = (formA.existing_emi || 0) + emi;
    const dti = ratioPct(totalEmi, formA.monthly_income || 0);
    return { emi, totalEmi, dti };
  }, [formA, resA]);

  const derivedB = useMemo(() => {
    const emi = resB?.emi ?? 0;
    const totalEmi = (formB.existing_emi || 0) + emi;
    const dti = ratioPct(totalEmi, formB.monthly_income || 0);
    return { emi, totalEmi, dti };
  }, [formB, resB]);

  const riskScoreA = useMemo(() => {
    const base = clamp(derivedA.dti, 0, 90);
    const bump = resA?.risk === "HIGH" ? 18 : resA?.risk === "MEDIUM" ? 10 : resA?.risk === "LOW" ? 3 : 0;
    return clamp(base + bump, 0, 100);
  }, [derivedA.dti, resA]);

  const riskScoreB = useMemo(() => {
    const base = clamp(derivedB.dti, 0, 90);
    const bump = resB?.risk === "HIGH" ? 18 : resB?.risk === "MEDIUM" ? 10 : resB?.risk === "LOW" ? 3 : 0;
    return clamp(base + bump, 0, 100);
  }, [derivedB.dti, resB]);

  const delta = useMemo(() => {
    if (!resA || !resB) return null;
    return {
      emi: resB.emi - resA.emi,
      total_payable: resB.total_payable - resA.total_payable,
      total_interest: resB.total_interest - resA.total_interest,
      effective_apr: resB.effective_apr - resA.effective_apr,
    };
  }, [resA, resB]);

  async function analyzeOne(form: LoanForm, which: "A" | "B") {
    const setRes = which === "A" ? setResA : setResB;
    const setErr = which === "A" ? setErrorA : setErrorB;

    setErr("");
    const r = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`API error (${r.status}). ${txt || "Backend not ready."}`);
    }

    const data = (await r.json()) as ApiResult;
    setRes(data);

    const scenario: SavedScenario = {
      id: safeId("SC"),
      label:
        which === "A"
          ? `Loan A • ${fmtINR(form.principal)} • ${form.tenure_months}m`
          : `Loan B • ${fmtINR(form.principal)} • ${form.tenure_months}m`,
      createdAt: new Date().toISOString(),
      form,
      result: data,
    };

    persistSaved([scenario, ...saved].slice(0, 3));
  }

  async function analyze() {
    setLoading(true);
    setErrorA("");
    setErrorB("");

    try {
      setReportId(safeId());
      const d = new Date();
      setReportTime(
        d.toLocaleString("en-IN", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      );

      if (mode === "single") {
        await analyzeOne(formA, "A");
      } else {
        await Promise.all([analyzeOne(formA, "A"), analyzeOne(formB, "B")]);
      }

      setResultAnimKey((k) => k + 1);
    } catch (e: any) {
      const msg = e?.message || "Failed to fetch. Is backend running?";
      if (mode === "single") setErrorA(msg);
      else {
        setErrorA(msg);
        setErrorB(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const bg =
    theme === "dark"
      ? "bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100"
      : "bg-gradient-to-b from-slate-50 via-slate-50 to-white text-slate-900";

  const card =
    theme === "dark"
      ? "bg-white/5 border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]"
      : "bg-white border-slate-200 shadow-[0_20px_60px_-35px_rgba(2,6,23,0.25)]";

  const panel = theme === "dark" ? "bg-black/20 border-white/10" : "bg-slate-50 border-slate-200";
  const muted = theme === "dark" ? "text-slate-400" : "text-slate-500";

  const navItem = (active: boolean) =>
    theme === "dark"
      ? active
        ? "bg-white/10 text-white border-white/15"
        : "bg-transparent text-slate-300 border-transparent hover:bg-white/5 hover:border-white/10"
      : active
      ? "bg-slate-900 text-white border-slate-900"
      : "bg-transparent text-slate-700 border-transparent hover:bg-slate-100 hover:border-slate-200";

  useEffect(() => {
    if (activePage === "Compare") setMode("compare");
    if (activePage === "Dashboard") setMode("single");
  }, [activePage]);

  function escapeHtml(s: string) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ Printing via hidden iframe = avoids popup blockers + avoids blank white tab
  function printHtml(html: string) {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      alert("Couldn’t open print frame. Try again.");
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        // cleanup after a moment
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 800);
      }
    };

    // wait a bit for layout + images
    iframe.onload = () => setTimeout(doPrint, 450);
    // also fallback if onload doesn't fire
    setTimeout(doPrint, 900);
  }

  function exportPDF() {
    const hasA = !!resA;
    const hasB = mode === "compare" ? !!resB : true;
    if (!hasA || !hasB) {
      alert("Run Analyze first, then export PDF.");
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleString("en-IN");

    const aDTI = derivedA.dti;
    const bDTI = derivedB.dti;

    const deltaBlock =
      mode === "compare" && resA && resB && delta
        ? `
      <div class="grid">
        <div class="card">
          <div class="label">Delta EMI (B − A)</div>
          <div class="value">${delta.emi >= 0 ? "+" : "−"}${fmtINR(Math.abs(delta.emi))}</div>
          <div class="sub">Lower is better</div>
        </div>
        <div class="card">
          <div class="label">Delta APR</div>
          <div class="value">${delta.effective_apr >= 0 ? "+" : "−"}${fmtNum(Math.abs(delta.effective_apr))}%</div>
          <div class="sub">Interest rate difference</div>
        </div>
        <div class="card">
          <div class="label">Delta Total Payable</div>
          <div class="value">${delta.total_payable >= 0 ? "+" : "−"}${fmtINR(Math.abs(delta.total_payable))}</div>
          <div class="sub">Lifetime cost difference</div>
        </div>
        <div class="card">
          <div class="label">Delta Total Interest</div>
          <div class="value">${delta.total_interest >= 0 ? "+" : "−"}${fmtINR(Math.abs(delta.total_interest))}</div>
          <div class="sub">Interest-only difference</div>
        </div>
      </div>
      `
        : "";

    const riskBadge = (r: ApiResult["risk"]) => {
      if (r === "LOW") return `<span class="pill pill-green">LOW RISK</span>`;
      if (r === "MEDIUM") return `<span class="pill pill-amber">MEDIUM RISK</span>`;
      return `<span class="pill pill-red">HIGH RISK</span>`;
    };

    const flagsList = (flags: ApiFlag[]) =>
      flags?.length
        ? flags
            .slice(0, 10)
            .map((f) => `<li><b>${f.type}:</b> ${escapeHtml(f.msg)}</li>`)
            .join("")
        : `<li>No flags</li>`;

    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>LoanLens Report ${reportId}</title>
<base href="${origin}/" />
<style>
  *{ box-sizing:border-box; }
  body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background:#ffffff; color:#0b1220; }
  .wrap{ max-width: 980px; margin: 26px auto; padding: 0 18px; }
  .top{ display:flex; justify-content:space-between; align-items:center; gap:16px; }
  .brand{ display:flex; align-items:center; gap:10px; }
  .logo{ width:42px; height:42px; border-radius:12px; border:1px solid #e5e7eb; padding:6px; background:#fff; }
  h1{ margin:0; font-size:20px; }
  .meta{ color:#475569; font-size:12px; margin-top:2px; }
  .hr{ height:1px; background:#e5e7eb; margin:18px 0; }
  .grid{ display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; }
  .card{ border:1px solid #e5e7eb; border-radius:16px; padding:12px; background:#fff; }
  .label{ font-size:11px; font-weight:700; color:#64748b; }
  .value{ font-size:18px; font-weight:800; margin-top:6px; }
  .sub{ font-size:11px; color:#64748b; margin-top:2px; }
  .section{ margin-top:14px; }
  .section h2{ font-size:14px; margin:0 0 8px 0; }
  .two{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
  .pill{ display:inline-block; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:800; border:1px solid; }
  .pill-green{ color:#065f46; background:#d1fae5; border-color:#a7f3d0; }
  .pill-amber{ color:#92400e; background:#ffedd5; border-color:#fed7aa; }
  .pill-red{ color:#991b1b; background:#fee2e2; border-color:#fecaca; }
  ul{ margin:8px 0 0 18px; padding:0; }
  li{ margin:6px 0; color:#0f172a; }
  .note{ font-size:11px; color:#64748b; margin-top:10px; }
  @media print { .no-print{ display:none; } .wrap{ margin: 0 auto; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">
        <img class="logo" src="logo.png" />
        <div>
          <h1>LoanLens Risk Assessment Report</h1>
          <div class="meta">Report ID: <b>${reportId}</b> • Generated: <b>${timestamp}</b></div>
        </div>
      </div>
      <div class="no-print">
        <button onclick="window.print()" style="padding:10px 12px;border-radius:12px;border:1px solid #e5e7eb;background:#0b1220;color:#fff;font-weight:800;cursor:pointer">
          Print / Save as PDF
        </button>
      </div>
    </div>

    <div class="hr"></div>

    <div class="grid">
      <div class="card">
        <div class="label">Loan A • EMI</div>
        <div class="value">${fmtINR(resA!.emi)}</div>
        <div class="sub">APR ${fmtNum(resA!.effective_apr)}%</div>
      </div>
      <div class="card">
        <div class="label">Loan A • DTI</div>
        <div class="value">${fmtNum(aDTI)}%</div>
        <div class="sub">${escapeHtml(badgeForDTI(aDTI).label)}</div>
      </div>
      <div class="card">
        <div class="label">Loan A • Total Payable</div>
        <div class="value">${fmtINR(resA!.total_payable)}</div>
        <div class="sub">Total repayment</div>
      </div>
      <div class="card">
        <div class="label">Loan A • Total Interest</div>
        <div class="value">${fmtINR(resA!.total_interest)}</div>
        <div class="sub">Interest-only</div>
      </div>
    </div>

    ${
      mode === "compare" && resB
        ? `
    <div class="section">
      <h2>Loan B Snapshot</h2>
      <div class="grid">
        <div class="card">
          <div class="label">Loan B • EMI</div>
          <div class="value">${fmtINR(resB.emi)}</div>
          <div class="sub">APR ${fmtNum(resB.effective_apr)}%</div>
        </div>
        <div class="card">
          <div class="label">Loan B • DTI</div>
          <div class="value">${fmtNum(bDTI)}%</div>
          <div class="sub">${escapeHtml(badgeForDTI(bDTI).label)}</div>
        </div>
        <div class="card">
          <div class="label">Loan B • Total Payable</div>
          <div class="value">${fmtINR(resB.total_payable)}</div>
          <div class="sub">Total repayment</div>
        </div>
        <div class="card">
          <div class="label">Loan B • Total Interest</div>
          <div class="value">${fmtINR(resB.total_interest)}</div>
          <div class="sub">Interest-only</div>
        </div>
      </div>
    </div>
    ${deltaBlock}
    `
        : ""
    }

    <div class="section">
      <h2>Risk Summary</h2>
      <div class="two">
        <div class="card">
          <div class="label">Loan A Risk</div>
          <div style="margin-top:8px;">${riskBadge(resA!.risk)}</div>
          <div class="note">Based on backend flags + DTI + cost signals.</div>
        </div>
        ${
          mode === "compare" && resB
            ? `<div class="card">
                 <div class="label">Loan B Risk</div>
                 <div style="margin-top:8px;">${riskBadge(resB.risk)}</div>
                 <div class="note">Compare badges + deltas to pick better offer.</div>
               </div>`
            : `<div class="card">
                 <div class="label">Recommendation</div>
                 <div class="note" style="margin-top:10px;">
                   Prefer lower EMI, lower APR, and DTI under 40% when possible.
                 </div>
               </div>`
        }
      </div>
    </div>

    <div class="section">
      <h2>Flags</h2>
      <div class="two">
        <div class="card">
          <div class="label">Loan A Flags</div>
          <ul>${flagsList(resA!.flags || [])}</ul>
        </div>
        ${
          mode === "compare" && resB
            ? `<div class="card">
                 <div class="label">Loan B Flags</div>
                 <ul>${flagsList(resB.flags || [])}</ul>
               </div>`
            : `<div class="card">
                 <div class="label">Notes</div>
                 <div class="note" style="margin-top:10px;">
                   Flags are human-readable reasons behind risk classification.
                 </div>
               </div>`
        }
      </div>
    </div>

    <div class="hr"></div>
    <div class="note">
      LoanLens • Generated for academic demo. Always verify with official lender schedule.
    </div>
  </div>
</body>
</html>
`;

    printHtml(html);
  }

  async function copyReportId() {
    try {
      await navigator.clipboard.writeText(reportId || "");
      setToast("Report ID copied ✅");
    } catch {
      setToast("Couldn’t copy (browser blocked)");
    }
  }

  return (
    <main className={`min-h-screen ${bg} antialiased`}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .anim-fadeUp { animation: fadeUp 420ms ease-out both; }
        .btn-press:active { transform: scale(0.99); }

        @keyframes shimmer {
          0% { background-position: 0% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0.06) 60%);
          background-size: 200% 100%;
          animation: shimmer 1.1s linear infinite;
          border-radius: 12px;
        }
      `}</style>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div
            className={`rounded-full border px-4 py-2 text-sm font-semibold shadow-xl ${
              theme === "dark"
                ? "border-white/10 bg-slate-950/90 text-slate-100"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {toast}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* SIDEBAR */}
          <aside className={`no-print lg:col-span-3 rounded-2xl border p-4 ${card}`}>
            <div className="flex items-center gap-3">
              <div
                className={`h-11 w-11 rounded-xl border ${
                  theme === "dark" ? "bg-slate-900/60 border-white/10" : "bg-white border-slate-200"
                } p-1`}
              >
                <img src="/logo.png" alt="LoanLens" className="h-full w-full object-contain" draggable={false} />
              </div>
              <div>
                <div className="text-lg font-bold leading-tight">LoanLens</div>
                <div className={`text-xs ${muted}`}>Analytical Console</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${navItem(
                  activePage === "Dashboard"
                )}`}
                onClick={() => setActivePage("Dashboard")}
              >
                Dashboard
              </button>
              <button
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${navItem(
                  activePage === "Reports"
                )}`}
                onClick={() => setActivePage("Reports")}
              >
                Reports
              </button>
              <button
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${navItem(
                  activePage === "Compare"
                )}`}
                onClick={() => setActivePage("Compare")}
              >
                Compare
              </button>
              <button
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${navItem(
                  activePage === "Settings"
                )}`}
                onClick={() => setActivePage("Settings")}
              >
                Settings
              </button>
            </div>

            <div className={`mt-5 rounded-2xl border p-3 ${panel}`}>
              <div className={`text-[11px] font-semibold ${muted}`}>Report Meta</div>
              <div className="mt-2 text-sm">
                <div className={`${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>
                  ID: <b>{reportId || "—"}</b>
                </div>
                <div className={`${muted}`}>Generated: {reportTime || "—"}</div>

                <button
                  onClick={copyReportId}
                  className={`btn-press mt-3 w-full rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    theme === "dark"
                      ? "border-white/10 bg-white/10 hover:bg-white/15"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  Copy Report ID
                </button>
              </div>
            </div>

            <div className={`mt-4 text-[11px] ${muted}`}>
              Tip: If “Failed to fetch”, backend isn’t running on <b>{API_BASE}</b>.
            </div>
          </aside>

          {/* MAIN */}
          <section className={`lg:col-span-9 rounded-2xl border p-4 sm:p-5 ${card}`}>
            {/* TOP BAR */}
            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xl font-bold">{activePage}</div>
                <div className={`text-xs ${muted}`}>
                  {activePage === "Dashboard" && "Single loan analysis with risk flags"}
                  {activePage === "Compare" && "Compare two offers side-by-side + delta"}
                  {activePage === "Reports" && "Saved scenarios from your recent runs"}
                  {activePage === "Settings" && "Theme + glossary (DTI, EMI, APR, Delta...)"}
                </div>
              </div>

              {/* TOP RIGHT ACTIONS */}
              <div className="flex items-center gap-2">
                <button
                  className={`btn-press rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    demoMode
                      ? theme === "dark"
                        ? "border-sky-500/30 bg-sky-500/15 hover:bg-sky-500/20"
                        : "border-sky-200 bg-sky-50 hover:bg-sky-100"
                      : theme === "dark"
                      ? "border-white/10 bg-white/10 hover:bg-white/15"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => setDemoMode((v) => !v)}
                  title="Faculty Demo Mode"
                >
                  Demo: {demoMode ? "ON" : "OFF"}
                </button>

                <button
                  className={`btn-press rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    theme === "dark"
                      ? "border-white/10 bg-white/10 hover:bg-white/15"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                  title="Toggle theme"
                >
                  {theme === "dark" ? "Light" : "Dark"}
                </button>

                <button
                  className={`btn-press rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    theme === "dark"
                      ? "border-white/10 bg-white/10 hover:bg-white/15"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  onClick={exportPDF}
                  title="Export a clean PDF report"
                >
                  Export PDF
                </button>

                <button
                  onClick={analyze}
                  className={`btn-press rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    theme === "dark"
                      ? "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-[0_10px_25px_-12px_rgba(56,189,248,0.8)]"
                      : "bg-slate-900 hover:bg-slate-800 text-white shadow-[0_10px_25px_-12px_rgba(2,6,23,0.5)]"
                  }`}
                >
                  {loading ? "Analyzing…" : mode === "compare" ? "Analyze Both" : "Analyze"}
                </button>

                <button
                  onClick={() => {
                    setResA(null);
                    setResB(null);
                    setErrorA("");
                    setErrorB("");
                  }}
                  className={`btn-press rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    theme === "dark"
                      ? "border-white/10 bg-white/10 hover:bg-white/15"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* KPI STRIP */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KPI
                theme={theme}
                title="Loan A • DTI"
                value={`${fmtNum(derivedA.dti)}%`}
                subtitle={badgeForDTI(derivedA.dti).label}
                right={
                  <RiskGauge
                    theme={theme}
                    value={riskScoreA}
                    label="Risk Trend"
                    hint="Composite score using DTI + backend risk"
                  />
                }
              />
              <KPI
                theme={theme}
                title="Loan A • EMI"
                value={resA ? fmtINR(resA.emi) : "—"}
                subtitle={resA ? `APR ${fmtNum(resA.effective_apr)}%` : "Run analysis"}
                right={loading ? <div className="h-16 w-16 skeleton" /> : null}
              />
              <KPI
                theme={theme}
                title={mode === "compare" ? "Loan B • DTI" : "Total EMI Burden"}
                value={mode === "compare" ? `${fmtNum(derivedB.dti)}%` : fmtINR(derivedA.totalEmi)}
                subtitle={mode === "compare" ? badgeForDTI(derivedB.dti).label : "existing + new"}
                right={
                  mode === "compare" ? (
                    <RiskGauge theme={theme} value={riskScoreB} label="Risk Trend" hint="Loan B trend score" />
                  ) : null
                }
              />
              <KPI
                theme={theme}
                title={mode === "compare" ? "Delta EMI (B−A)" : "Risk Label"}
                value={
                  mode === "compare" && delta
                    ? `${delta.emi >= 0 ? "+" : "−"}${fmtINR(Math.abs(delta.emi))}`
                    : resA
                    ? resA.risk
                    : "—"
                }
                subtitle={mode === "compare" ? "lower is better" : "based on flags"}
              />
            </div>

            {/* DEMO HINTS UNDER KPI */}
            {demoMode ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <DemoHint
                  theme={theme}
                  icon="🎯"
                  title="What the model checks"
                  body="Affordability (DTI), cost signals (APR + fees), and risk flags. Risk Trend is a 0–100 visual score combining DTI + backend risk bucket."
                />
                <DemoHint
                  theme={theme}
                  icon="📊"
                  title="Why DTI matters"
                  body="DTI = (existing EMI + new EMI) / income. If it’s high, even a ‘good’ APR can still be risky due to cashflow stress."
                />
                <DemoHint
                  theme={theme}
                  icon="🧾"
                  title="Demo line for faculty"
                  body="“This isn’t just EMI — it explains WHY the loan is risky using flags and prints a clean report (PDF) for documentation.”"
                />
              </div>
            ) : null}

            {/* PAGES */}
            {activePage === "Dashboard" && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className={`rounded-2xl border p-4 ${panel}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Loan A Inputs</div>
                    {resA ? (
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${riskPillCls(
                          resA.risk,
                          theme
                        )}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${riskDotCls(resA.risk)}`} />
                        {resA.risk}
                      </span>
                    ) : (
                      <span className={`text-xs ${muted}`}>Not analyzed</span>
                    )}
                  </div>

                  {demoMode ? (
                    <div className="mt-3">
                      <DemoHint
                        theme={theme}
                        icon="🧠"
                        title="Input → Output pipeline"
                        body="You change loan parameters here. The backend calculates EMI, total payable, interest, effective APR, then returns risk + readable flags."
                      />
                    </div>
                  ) : null}

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field
                      theme={theme}
                      label="Principal (₹)"
                      value={formA.principal}
                      onChange={(v) => setFormA((p) => ({ ...p, principal: v }))}
                    />
                    <Field
                      theme={theme}
                      label="Interest (% p.a.)"
                      value={formA.annual_interest_rate}
                      onChange={(v) => setFormA((p) => ({ ...p, annual_interest_rate: v }))}
                    />
                    <Field
                      theme={theme}
                      label="Tenure (months)"
                      value={formA.tenure_months}
                      onChange={(v) => setFormA((p) => ({ ...p, tenure_months: v }))}
                    />
                    <Field
                      theme={theme}
                      label="Processing fee (₹)"
                      value={formA.processing_fee}
                      onChange={(v) => setFormA((p) => ({ ...p, processing_fee: v }))}
                    />
                    <Field
                      theme={theme}
                      label="Monthly income (₹)"
                      value={formA.monthly_income}
                      onChange={(v) => setFormA((p) => ({ ...p, monthly_income: v }))}
                    />
                    <Field
                      theme={theme}
                      label="Existing EMI (₹)"
                      value={formA.existing_emi}
                      onChange={(v) => setFormA((p) => ({ ...p, existing_emi: v }))}
                    />
                  </div>
                </div>

                <div key={resultAnimKey} className={`anim-fadeUp rounded-2xl border p-4 ${panel}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Loan A Output</div>
                    <div className={`text-xs ${muted}`}>Income vs EMI visualization</div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <MiniBar
                      theme={theme}
                      label="Monthly income"
                      value={formA.monthly_income}
                      max={Math.max(formA.monthly_income, derivedA.totalEmi, 1)}
                    />
                    <MiniBar
                      theme={theme}
                      label="Existing EMI"
                      value={formA.existing_emi}
                      max={Math.max(formA.monthly_income, derivedA.totalEmi, 1)}
                    />
                    <MiniBar
                      theme={theme}
                      label="New EMI"
                      value={resA?.emi ?? 0}
                      max={Math.max(formA.monthly_income, derivedA.totalEmi, 1)}
                    />
                  </div>

                  {demoMode ? (
                    <div className="mt-3">
                      <DemoHint
                        theme={theme}
                        icon="⚡"
                        title="What the bars show"
                        body="Faculty-friendly: It’s a quick affordability picture. If the total EMI bar grows near income, risk rises even if APR is low."
                      />
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="h-16 skeleton" />
                      <div className="h-16 skeleton" />
                    </div>
                  ) : null}

                  {errorA ? (
                    <div
                      className={`mt-4 rounded-xl border p-3 text-sm ${
                        theme === "dark"
                          ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      {errorA}
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div
                      className={`rounded-xl border p-3 ${
                        theme === "dark" ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className={`text-[11px] ${muted}`}>Total Payable</div>
                      <div className="mt-1 text-sm font-semibold">{resA ? fmtINR(resA.total_payable) : "—"}</div>
                    </div>
                    <div
                      className={`rounded-xl border p-3 ${
                        theme === "dark" ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className={`text-[11px] ${muted}`}>Total Interest</div>
                      <div className="mt-1 text-sm font-semibold">{resA ? fmtINR(resA.total_interest) : "—"}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className={`text-xs font-semibold ${muted}`}>Flags</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {resA?.flags?.length ? (
                        resA.flags.map((f, idx) => (
                          <span key={idx} className={`rounded-full border px-3 py-1 text-xs ${flagChip(f, theme)}`}>
                            <b className="mr-1">{f.type}:</b> {f.msg}
                          </span>
                        ))
                      ) : (
                        <div className={`text-sm ${muted}`}>—</div>
                      )}
                    </div>
                  </div>

                  {demoMode ? (
                    <div className="mt-3">
                      <DemoHint
                        theme={theme}
                        icon="🔎"
                        title="Why flags are important"
                        body="They convert model reasoning into plain English. This is the difference between a calculator and a decision-support tool."
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {activePage === "Compare" && (
              <div className="mt-5">
                {demoMode ? (
                  <DemoHint
                    theme={theme}
                    icon="🥊"
                    title="Compare mode explanation"
                    body="This shows both loans with the same metrics and a Delta panel (B − A). Faculty can clearly see which loan is cheaper AND which is safer."
                  />
                ) : null}

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className={`rounded-2xl border p-4 ${panel}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Loan A</div>
                      {resA ? (
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${riskPillCls(
                            resA.risk,
                            theme
                          )}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${riskDotCls(resA.risk)}`} />
                          {resA.risk}
                        </span>
                      ) : (
                        <span className={`text-xs ${muted}`}>Not analyzed</span>
                      )}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field theme={theme} label="Principal (₹)" value={formA.principal} onChange={(v) => setFormA((p) => ({ ...p, principal: v }))} />
                      <Field theme={theme} label="Interest (% p.a.)" value={formA.annual_interest_rate} onChange={(v) => setFormA((p) => ({ ...p, annual_interest_rate: v }))} />
                      <Field theme={theme} label="Tenure (months)" value={formA.tenure_months} onChange={(v) => setFormA((p) => ({ ...p, tenure_months: v }))} />
                      <Field theme={theme} label="Processing fee (₹)" value={formA.processing_fee} onChange={(v) => setFormA((p) => ({ ...p, processing_fee: v }))} />
                      <Field theme={theme} label="Income (₹)" value={formA.monthly_income} onChange={(v) => setFormA((p) => ({ ...p, monthly_income: v }))} />
                      <Field theme={theme} label="Existing EMI (₹)" value={formA.existing_emi} onChange={(v) => setFormA((p) => ({ ...p, existing_emi: v }))} />
                    </div>
                  </div>

                  <div className={`rounded-2xl border p-4 ${panel}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Loan B</div>
                      {resB ? (
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${riskPillCls(
                            resB.risk,
                            theme
                          )}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${riskDotCls(resB.risk)}`} />
                          {resB.risk}
                        </span>
                      ) : (
                        <span className={`text-xs ${muted}`}>Not analyzed</span>
                      )}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field theme={theme} label="Principal (₹)" value={formB.principal} onChange={(v) => setFormB((p) => ({ ...p, principal: v }))} />
                      <Field theme={theme} label="Interest (% p.a.)" value={formB.annual_interest_rate} onChange={(v) => setFormB((p) => ({ ...p, annual_interest_rate: v }))} />
                      <Field theme={theme} label="Tenure (months)" value={formB.tenure_months} onChange={(v) => setFormB((p) => ({ ...p, tenure_months: v }))} />
                      <Field theme={theme} label="Processing fee (₹)" value={formB.processing_fee} onChange={(v) => setFormB((p) => ({ ...p, processing_fee: v }))} />
                      <Field theme={theme} label="Income (₹)" value={formB.monthly_income} onChange={(v) => setFormB((p) => ({ ...p, monthly_income: v }))} />
                      <Field theme={theme} label="Existing EMI (₹)" value={formB.existing_emi} onChange={(v) => setFormB((p) => ({ ...p, existing_emi: v }))} />
                    </div>
                  </div>

                  <div key={resultAnimKey} className={`anim-fadeUp lg:col-span-2 rounded-2xl border p-4 ${panel}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Delta (B − A)</div>
                      <div className={`text-xs ${muted}`}>Analyze both to populate</div>
                    </div>

                    {errorA || errorB ? (
                      <div
                        className={`mt-3 rounded-xl border p-3 text-sm ${
                          theme === "dark"
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {errorA || errorB}
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      {[
                        { k: "EMI Δ", v: delta ? `${delta.emi >= 0 ? "+" : "−"}${fmtINR(Math.abs(delta.emi))}` : "—" },
                        { k: "APR Δ", v: delta ? `${delta.effective_apr >= 0 ? "+" : "−"}${fmtNum(Math.abs(delta.effective_apr))}%` : "—" },
                        { k: "Payable Δ", v: delta ? `${delta.total_payable >= 0 ? "+" : "−"}${fmtINR(Math.abs(delta.total_payable))}` : "—" },
                        { k: "Interest Δ", v: delta ? `${delta.total_interest >= 0 ? "+" : "−"}${fmtINR(Math.abs(delta.total_interest))}` : "—" },
                      ].map((x) => (
                        <div
                          key={x.k}
                          className={`rounded-xl border p-3 ${
                            theme === "dark" ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className={`text-[11px] ${muted}`}>{x.k}</div>
                          <div className="mt-1 text-sm font-semibold tabular-nums">{x.v}</div>
                        </div>
                      ))}
                    </div>

                    {demoMode ? (
                      <div className="mt-3">
                        <DemoHint
                          theme={theme}
                          icon="✅"
                          title="How to answer faculty questions"
                          body="If they ask “which is better?”, you say: choose the loan with lower monthly EMI AND lower DTI (affordability) AND fewer high-risk flags."
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {activePage === "Reports" && (
              <div className="mt-5">
                {demoMode ? (
                  <DemoHint
                    theme={theme}
                    icon="🗂️"
                    title="Saved Scenarios"
                    body="This is your demo history. Click one to load it into Dashboard instantly. It looks like a real fintech workflow."
                  />
                ) : null}

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Saved Scenarios (last 3)</div>
                  <button
                    className={`text-xs underline underline-offset-4 ${
                      theme === "dark" ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                    onClick={() => persistSaved([])}
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {saved.length === 0 ? (
                    <div className={`text-sm ${muted}`}>No saved scenarios yet. Run Analyze.</div>
                  ) : (
                    saved.map((s) => (
                      <button
                        key={s.id}
                        className={`w-full rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl ${
                          theme === "dark"
                            ? "border-white/10 bg-white/5 hover:bg-white/8"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        onClick={() => {
                          setFormA(s.form);
                          setResA(s.result);
                          setErrorA("");
                          setActivePage("Dashboard");
                          setMode("single");
                          setResultAnimKey((k) => k + 1);
                          setToast("Loaded scenario ✅");
                        }}
                        title="Load into Loan A"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold">{s.label}</div>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${riskPillCls(s.result.risk, theme)}`}>
                            {s.result.risk}
                          </span>
                        </div>
                        <div className={`mt-1 text-[11px] ${muted}`}>
                          EMI {fmtINR(s.result.emi)} • APR {fmtNum(s.result.effective_apr)}% •{" "}
                          {new Date(s.createdAt).toLocaleString("en-IN")}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {activePage === "Settings" && (
              <div className={`mt-5 rounded-2xl border p-4 ${panel}`}>
                <div className="text-sm font-semibold">Settings & Glossary</div>
                <div className={`mt-1 text-xs ${muted}`}>Use this to explain metrics (DTI, EMI, APR, Delta) during viva.</div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    className={`btn-press rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      theme === "dark"
                        ? "border-white/10 bg-white/10 hover:bg-white/15"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => setTheme("dark")}
                  >
                    Set Dark
                  </button>
                  <button
                    className={`btn-press rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      theme === "dark"
                        ? "border-white/10 bg-white/10 hover:bg-white/15"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => setTheme("light")}
                  >
                    Set Light
                  </button>
                  <button
                    className={`btn-press rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      demoMode
                        ? theme === "dark"
                          ? "border-sky-500/30 bg-sky-500/15 hover:bg-sky-500/20"
                          : "border-sky-200 bg-sky-50 hover:bg-sky-100"
                        : theme === "dark"
                        ? "border-white/10 bg-white/10 hover:bg-white/15"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => setDemoMode((v) => !v)}
                  >
                    Demo Mode: {demoMode ? "ON" : "OFF"}
                  </button>
                  <button
                    className={`btn-press rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                      theme === "dark"
                        ? "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-100"
                        : "border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                    }`}
                    onClick={() => {
                      setResA(null);
                      setResB(null);
                      setErrorA("");
                      setErrorB("");
                      persistSaved([]);
                      setToast("Reset done");
                    }}
                  >
                    Reset Everything
                  </button>
                </div>

                {demoMode ? (
                  <div className="mt-4">
                    <DemoHint
                      theme={theme}
                      icon="🎤"
                      title="Viva-ready explanation (1 line)"
                      body="“LoanLens evaluates both affordability (DTI) and cost (APR/interest/fees), then explains risk using human-readable flags and generates a PDF report.”"
                    />
                  </div>
                ) : null}

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <GlossaryItem theme={theme} title="DTI (Debt-to-Income %)" body="DTI = (Total EMI burden / Monthly Income) × 100. Lower DTI = safer." />
                  <GlossaryItem theme={theme} title="EMI (Equated Monthly Installment)" body="Fixed monthly payment for the loan. Includes interest + principal." />
                  <GlossaryItem theme={theme} title="APR (Effective Annual Percentage Rate)" body="APR is the effective annual cost of borrowing. Can exceed nominal rate due to fees/structure." />
                  <GlossaryItem theme={theme} title="Risk Trend Gauge" body="A 0–100 visual meter using DTI + backend risk. Higher score means more stress / higher risk." />
                  <GlossaryItem theme={theme} title="Delta EMI (B − A)" body="Difference between Loan B EMI and Loan A EMI. Positive means B costs more per month." />
                  <GlossaryItem theme={theme} title="Total Payable" body="Total amount repaid over the full tenure." />
                  <GlossaryItem theme={theme} title="Total Interest" body="Only the interest portion paid over the tenure." />
                  <GlossaryItem theme={theme} title="Flags" body="Human-readable reasons behind the risk badge (e.g., high DTI, high APR, affordability issues)." />
                </div>
              </div>
            )}
          </section>
        </div>

        <div className={`no-print mt-6 text-center text-xs ${muted}`}>
          LoanLens — Modern fintech console • Demo Mode + Risk Trend Gauge + PDF export + compare mode
        </div>
      </div>
    </main>
  );
}

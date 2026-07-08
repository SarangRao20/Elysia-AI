/**
 * ApiKeyGate — first-run onboarding.
 *
 * ELYSIA ships without any API key. On launch we ask the backend whether a key
 * is configured (GET /api/config). If not, this full-screen overlay blocks the
 * app until the user pastes their own Google Gemini key, which the backend
 * validates with a live test call and stores in their per-user data folder.
 *
 * The key never touches localStorage and is never sent back to the frontend.
 */

import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { KeyRound, Loader2, ExternalLink, ShieldCheck } from "lucide-react";

type Phase = "checking" | "needsKey" | "ready";

export function ApiKeyGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        setPhase(data.hasApiKey ? "ready" : "needsKey");
      } catch {
        // Backend not up yet — assume onboarding needed rather than hard-fail.
        if (!cancelled) setPhase("needsKey");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const key = value.trim();
    if (!key || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/config/apikey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the key.");
      setValue("");
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "ready") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050509] text-white">
      {/* Ambient glows to match the app's aesthetic */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-indigo-700/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-cyan-700/15 blur-[150px]" />

      {phase === "checking" ? (
        <div className="flex flex-col items-center gap-4 text-white/60">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="text-sm tracking-wide">Starting ELYSIA…</span>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="relative z-10 w-[min(92vw,460px)] rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 ring-1 ring-white/10">
              <KeyRound className="h-6 w-6 text-indigo-200" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Welcome to ELYSIA</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              ELYSIA runs on your own Google Gemini API key. Paste it below to get
              started — it stays on this computer and is never shared.
            </p>
          </div>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
            Gemini API key
          </label>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIza…"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !value.trim()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </>
            ) : (
              <>Continue</>
            )}
          </button>

          <div className="mt-5 flex items-center justify-between text-xs text-white/40">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Stored locally only
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-300 transition hover:text-indigo-200"
            >
              Get a free key <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </form>
      )}
    </div>
  );
}

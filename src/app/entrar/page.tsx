"use client";

import { BrandLogo } from "@/components/BrandLogo";
import { RaceAtmosphere } from "@/components/RaceAtmosphere";
import {
  StartingLights,
  type LightsPhase,
} from "@/components/StartingLights";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BACK } from "@/lib/back";
import { COPY } from "@/lib/copy";
import {
  authCatchMessage,
  entrarNoticeForError,
  loginConfirmNotice,
} from "@/lib/auth/messages";
import { safeInternalPath } from "@/lib/auth/next-path";
import { modeFromParams, type EntrarMode } from "@/lib/auth/entrar-mode";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { cn } from "@/lib/utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AUTH_TIMEOUT_MS = 20_000;
const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

type Mode = EntrarMode;

async function readAuthJson<T extends { error?: string }>(
  res: Response,
  fallback: string,
): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallback);
  }
}

function authFailMessage(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "Demorou demais. Tente de novo.";
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return "Demorou demais. Tente de novo.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53"
      />
    </svg>
  );
}

function AccessModeToggle({
  mode,
  onChange,
  reduce,
}: {
  mode: "login" | "signup";
  onChange: (next: "login" | "signup") => void;
  reduce: boolean | null;
}) {
  const options = [
    { value: "login" as const, label: COPY.entrarToggleLogin },
    { value: "signup" as const, label: COPY.entrarToggleSignup },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Modo de acesso"
      className="grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-0.5"
    >
      {options.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) onChange(option.value);
            }}
            className={cn(
              "relative rounded-full py-1.5 text-center text-xs font-extrabold transition",
              active
                ? "text-podium-white"
                : "text-podium-muted hover:text-podium-gray",
            )}
          >
            {active ? (
              reduce ? (
                <span className="absolute inset-0 rounded-full bg-white/10" />
              ) : (
                <motion.span
                  layoutId="entrar-mode-thumb"
                  className="absolute inset-0 rounded-full bg-white/10"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )
            ) : null}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function EntrarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<LightsPhase>("idle");
  const [litCount, setLitCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [mode, setMode] = useState<Mode>(() => modeFromParams(searchParams));
  const next = safeInternalPath(searchParams.get("next"));
  const showToggle = mode === "login" || mode === "signup";

  useEffect(() => {
    setMode(modeFromParams(searchParams));
  }, [searchParams]);

  async function lightsOutThenGo(dest = next) {
    void router.prefetch(dest);
    if (reduce) {
      router.push(dest);
      return;
    }
    setPhase("lighting");
    for (let i = 1; i <= 5; i++) {
      setLitCount(i);
      await sleep(80);
    }
    await sleep(120);
    setPhase("out");
    setLitCount(0);
    await sleep(90);
    setPhase("go");
    router.push(dest);
  }

  useEffect(() => {
    if (searchParams.get("definir") === "1") return;
    if (searchParams.get("go") === "1") {
      void lightsOutThenGo();
    }
    const fromError = entrarNoticeForError(searchParams.get("error"));
    if (fromError) setNotice(fromError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function switchMode(nextMode: Mode, options?: { keepNotice?: boolean }) {
    if (!options?.keepNotice) {
      setNotice(null);
      setAwaitingConfirm(false);
    }
    setPassword("");
    setPasswordConfirm("");
    setMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("definir");
    params.delete("error");
    params.delete("go");
    if (nextMode === "signup") params.set("modo", "cadastro");
    else if (nextMode === "recover") params.set("modo", "recuperar");
    else params.delete("modo");
    const query = params.toString();
    router.replace(query ? `/entrar?${query}` : "/entrar");
  }

  async function postAuth(
    payload: Record<string, unknown>,
    fallback: string,
  ) {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
    });
    const json = await readAuthJson<{
      mock?: boolean;
      confirm?: boolean;
      recover?: boolean;
      existing?: boolean;
      url?: string;
      error?: string;
      next?: string;
    }>(res, fallback);
    return { res, json };
  }

  async function enter(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    if (
      (mode === "signup" || mode === "definir") &&
      password !== passwordConfirm
    ) {
      setNotice("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      if (mode === "definir") {
        const fallback = authCatchMessage("password");
        const { res, json } = await postAuth(
          {
            action: "password",
            password,
            next,
          },
          fallback,
        );
        if (!res.ok) {
          setNotice(json.error ?? fallback);
          return;
        }
        if (json.mock) {
          localStorage.setItem("grid_mock_session", "1");
        }
        await lightsOutThenGo(json.next ?? next);
        return;
      }

      const action =
        mode === "signup" ? "signup" : mode === "recover" ? "recover" : "login";
      const fallback = authCatchMessage(action);
      const { res, json } = await postAuth(
        {
          action,
          email,
          password: mode === "recover" ? undefined : password,
          next,
        },
        fallback,
      );
      if (!res.ok) {
        setNotice(json.error ?? fallback);
        if (json.existing) {
          switchMode("login", { keepNotice: true });
        }
        return;
      }
      if (json.confirm) {
        setAwaitingConfirm(true);
        setNotice(loginConfirmNotice(email));
        switchMode("login", { keepNotice: true });
        return;
      }
      if (json.recover) {
        setNotice(COPY.loginRecover);
        return;
      }
      if (json.mock) {
        localStorage.setItem("grid_mock_session", "1");
      }
      await lightsOutThenGo(json.next ?? next);
    } catch (err) {
      const fallback = authCatchMessage(
        mode === "signup" ? "signup" : mode === "recover" ? "recover" : mode === "definir" ? "password" : "login",
      );
      setNotice(authFailMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  }

  async function enterWithGoogle() {
    if (loading) return;
    setLoading(true);
    setNotice(null);
    const fallback = authCatchMessage("google");
    try {
      const { res, json } = await postAuth(
        { action: "google", next },
        fallback,
      );
      if (!res.ok) {
        setNotice(json.error ?? fallback);
        return;
      }
      if (json.mock) {
        localStorage.setItem("grid_mock_session", "1");
        await lightsOutThenGo(json.next ?? next);
        return;
      }
      if (!json.url) {
        setNotice(fallback);
        return;
      }
      window.location.assign(json.url);
    } catch (err) {
      setNotice(authFailMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirm() {
    if (loading || !email.trim()) return;
    setLoading(true);
    const fallback = authCatchMessage("resend");
    try {
      const { res, json } = await postAuth(
        {
          action: "resend",
          email,
          next,
        },
        fallback,
      );
      if (!res.ok) {
        setNotice(json.error ?? fallback);
        return;
      }
      setAwaitingConfirm(true);
      setNotice(loginConfirmNotice(email));
    } catch (err) {
      setNotice(authFailMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  }

  const title = useMemo(() => {
    if (mode === "definir") return "Nova senha";
    if (mode === "recover") return "Recuperar senha";
    if (mode === "login") return COPY.entrarToggleLogin;
    return COPY.entrarToggleSignup;
  }, [mode]);

  const submitLabel = loading
    ? mode === "signup"
      ? "Criando…"
      : mode === "recover"
        ? "Enviando…"
        : mode === "definir"
          ? "Salvando…"
          : "Entrando…"
    : mode === "signup"
      ? COPY.entrarSignupLane
      : mode === "recover"
        ? "Enviar e-mail"
        : mode === "definir"
          ? "Salvar"
          : COPY.entrarLoginCta;

  const showPassword = mode !== "recover";
  const showConfirm = mode === "signup" || mode === "definir";
  const fadeTransition = reduce
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <RaceAtmosphere />

      <AnimatePresence>
        {phase === "go" ? (
          <motion.div
            key="go-flash"
            className="pointer-events-none fixed inset-0 z-50 bg-podium-yellow"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      {phase !== "idle" && phase !== "go" ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-podium-navy/92 backdrop-blur-md">
          <StartingLights litCount={litCount} phase={phase} />
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-10 w-full max-w-md",
          phase !== "idle" && "invisible",
        )}
        aria-hidden={phase !== "idle"}
      >
        <div className="mb-8 flex justify-center">
          <BrandLogo variant="endorsed" className="h-9 w-auto text-[2.25rem]" priority />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="p-6 md:p-8">
            {mode === "login" || mode === "signup" ? (
              <>
                <AccessModeToggle
                  mode={mode}
                  reduce={reduce}
                  onChange={(nextMode) => switchMode(nextMode)}
                />
                <h1 className="sr-only">{title}</h1>
              </>
            ) : (
              <h1 className="text-center text-2xl font-extrabold">{title}</h1>
            )}

            <form
              onSubmit={enter}
              className={showToggle ? "mt-5 space-y-4" : "mt-6 space-y-4"}
            >
              <motion.div
                key={mode}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fadeTransition}
                className="space-y-4"
              >
                  {mode === "signup" ? (
                    <div className="space-y-2 text-center">
                      <p className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-podium-yellow px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-podium-navy">
                        {COPY.entrarTrialBadge}
                        <span
                          className="h-1 w-1 rounded-full bg-podium-navy/35"
                          aria-hidden
                        />
                        <span className="font-bold normal-case tracking-normal">
                          {COPY.entrarTrialHint}
                        </span>
                      </p>
                      <p className="text-balance text-sm text-podium-muted">
                        {COPY.entrarSignupHook}
                      </p>
                    </div>
                  ) : null}
                  {mode === "login" ? (
                    <p className="text-balance text-center text-sm text-podium-muted">
                      {COPY.entrarLoginHook}
                    </p>
                  ) : null}

                  {showToggle ? (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void enterWithGoogle()}
                        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white px-3 py-3 text-sm font-extrabold text-podium-navy transition hover:brightness-95 disabled:opacity-60"
                      >
                        <GoogleMark className="h-5 w-5 shrink-0" />
                        {COPY.entrarGoogleCta}
                      </button>
                      <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-podium-muted">
                        <span className="h-px flex-1 bg-white/10" />
                        {COPY.entrarOrDivider}
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                    </>
                  ) : null}

                  {mode !== "definir" ? (
                    <label className="block text-sm text-podium-gray">
                      E-mail
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  ) : null}
                  {showPassword ? (
                    <label className="block text-sm text-podium-gray">
                      Senha
                      <input
                        type="password"
                        autoComplete={
                          mode === "login" ? "current-password" : "new-password"
                        }
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  ) : null}
                  {showConfirm ? (
                    <label className="block text-sm text-podium-gray">
                      Repetir senha
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  ) : null}
                  {notice ? (
                    <div className="space-y-2">
                      <p className="text-sm text-podium-yellow">{notice}</p>
                      {awaitingConfirm ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void resendConfirm()}
                          className="text-sm font-bold text-podium-gray hover:text-podium-white disabled:opacity-60"
                        >
                          Reenviar link
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-podium-yellow py-3.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110 disabled:opacity-60"
                  >
                    {submitLabel}
                  </button>
                  {mode === "login" ? (
                    <button
                      type="button"
                      onClick={() => switchMode("recover")}
                      className="block w-full text-center text-sm text-podium-muted hover:text-podium-white"
                    >
                      Esqueci a senha
                    </button>
                  ) : null}
                  {mode === "recover" || mode === "definir" ? (
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="block w-full text-center text-sm text-podium-muted hover:text-podium-white"
                    >
                      Voltar
                    </button>
                  ) : null}
                </motion.div>
            </form>
          </div>
        </div>

        <Link
          href={BACK.inicio.href}
          className="mt-6 block text-center text-sm text-podium-muted hover:text-podium-white"
        >
          ← {BACK.inicio.label}
        </Link>
      </div>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <EntrarInner />
    </Suspense>
  );
}

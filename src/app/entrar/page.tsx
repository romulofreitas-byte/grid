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
import { entrarNoticeForError, loginConfirmNotice } from "@/lib/auth/messages";
import { safeInternalPath } from "@/lib/auth/next-path";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { cn } from "@/lib/utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AUTH_TIMEOUT_MS = 20_000;
const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-podium-panel px-3 py-2.5 text-podium-white outline-none placeholder:text-podium-muted focus:border-podium-yellow/40";

type Mode = "login" | "signup" | "recover" | "definir";

async function readAuthJson<T extends { error?: string }>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Não foi possível entrar");
  }
}

function authFailMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "Demorou demais. Tente de novo.";
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return "Demorou demais. Tente de novo.";
  }
  return "Não foi possível entrar";
}

function modeFromParams(params: URLSearchParams): Mode {
  if (params.get("definir") === "1") return "definir";
  if (params.get("modo") === "entrar") return "login";
  if (params.get("modo") === "recuperar") return "recover";
  return "signup";
}

function AccessLane({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "relative px-3 py-3.5 text-sm font-extrabold transition md:px-4",
        active
          ? "bg-podium-yellow/12 text-podium-white"
          : "bg-white/[0.03] text-podium-muted hover:bg-white/[0.06] hover:text-podium-gray",
      )}
    >
      {active ? (
        <span className="absolute inset-x-0 top-0 h-0.5 bg-podium-yellow md:h-1" />
      ) : null}
      {label}
    </button>
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
  const showLanes = mode === "login" || mode === "signup";

  useEffect(() => {
    setMode(modeFromParams(searchParams));
  }, [searchParams]);

  async function lightsOutThenGo(dest = next) {
    if (reduce) {
      router.push(dest);
      return;
    }
    setPhase("lighting");
    for (let i = 1; i <= 5; i++) {
      setLitCount(i);
      await sleep(95);
    }
    await sleep(200);
    setPhase("out");
    setLitCount(0);
    await sleep(140);
    setPhase("go");
    await sleep(320);
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
    if (nextMode === "login") params.set("modo", "entrar");
    else if (nextMode === "recover") params.set("modo", "recuperar");
    else params.delete("modo");
    const query = params.toString();
    router.replace(query ? `/entrar?${query}` : "/entrar");
  }

  async function postAuth(payload: Record<string, unknown>) {
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
    }>(res);
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
        const { res, json } = await postAuth({
          action: "password",
          password,
          next,
        });
        if (!res.ok) {
          setNotice(json.error ?? "Não foi possível salvar a senha");
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
      const { res, json } = await postAuth({
        action,
        email,
        password: mode === "recover" ? undefined : password,
        next,
      });
      if (!res.ok) {
        setNotice(json.error ?? "Não foi possível entrar");
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
      setNotice(authFailMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirm() {
    if (loading || !email.trim()) return;
    setLoading(true);
    try {
      const { res, json } = await postAuth({
        action: "resend",
        email,
        next,
      });
      if (!res.ok) {
        setNotice(json.error ?? "Não foi possível reenviar");
        return;
      }
      setAwaitingConfirm(true);
      setNotice(loginConfirmNotice(email));
    } catch (err) {
      setNotice(authFailMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const title = useMemo(() => {
    if (mode === "definir") return "Nova senha";
    if (mode === "recover") return "Recuperar senha";
    if (mode === "login") return COPY.entrarLoginLane;
    return COPY.entrarSignupLane;
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
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ) : null}
      </AnimatePresence>

      {phase !== "idle" && phase !== "go" ? (
        <div className="pointer-events-none fixed inset-x-0 top-8 z-40 flex justify-center">
          <StartingLights litCount={litCount} phase={phase} />
        </div>
      ) : null}

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo variant="endorsed" className="h-9 w-auto text-[2.25rem]" priority />
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
          {showLanes ? (
            <div className="grid grid-cols-2 border-b border-white/10">
              <AccessLane
                active={mode === "signup"}
                label={COPY.entrarSignupLane}
                onSelect={() => {
                  if (mode !== "signup") switchMode("signup");
                }}
              />
              <AccessLane
                active={mode === "login"}
                label={COPY.entrarLoginLane}
                onSelect={() => {
                  if (mode !== "login") switchMode("login");
                }}
              />
            </div>
          ) : null}

          <div className="p-6 md:p-8">
            {showLanes ? (
              <h1 className="sr-only">{title}</h1>
            ) : (
              <h1 className="text-center text-2xl font-extrabold">{title}</h1>
            )}

            <form
              onSubmit={enter}
              className={showLanes ? "space-y-4" : "mt-6 space-y-4"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -6 }}
                  transition={fadeTransition}
                  className="space-y-4"
                >
                  {mode === "signup" ? (
                    <div className="space-y-2 text-center">
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-podium-yellow px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-podium-navy">
                        {COPY.entrarTrialBadge}
                        <span
                          className="h-1 w-1 rounded-full bg-podium-navy/35"
                          aria-hidden
                        />
                        <span className="font-bold normal-case tracking-normal">
                          {COPY.entrarTrialHint}
                        </span>
                      </p>
                      <p className="text-sm text-podium-muted">
                        {COPY.entrarSignupHook}
                      </p>
                    </div>
                  ) : null}
                  {mode === "login" ? (
                    <p className="text-center text-sm text-podium-muted">
                      {COPY.entrarLoginHook}
                    </p>
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
              </AnimatePresence>
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

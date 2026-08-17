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
import { entrarNoticeForError } from "@/lib/auth/messages";
import { isPaymentNext, safeInternalPath } from "@/lib/auth/next-path";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

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
  if (params.get("modo") === "cadastro") return "signup";
  if (params.get("modo") === "recuperar") return "recover";
  return "login";
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
  const [mode, setMode] = useState<Mode>(() => modeFromParams(searchParams));
  const next = safeInternalPath(searchParams.get("next"));
  const paying = isPaymentNext(next);

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
    if (!options?.keepNotice) setNotice(null);
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
        return;
      }
      if (json.confirm) {
        setNotice(COPY.loginConfirm);
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

  async function google() {
    if (loading) return;
    setLoading(true);
    setNotice(null);
    let leaving = false;
    try {
      const { res, json } = await postAuth({
        action: "google",
        provider: "google",
        next,
      });
      if (json.mock) {
        localStorage.setItem("grid_mock_session", "1");
        await lightsOutThenGo();
        return;
      }
      if (json.url) {
        leaving = true;
        window.location.href = json.url;
        return;
      }
      setNotice(json.error ?? "Google indisponível nesta demonstração");
      if (!res.ok && json.error) setNotice(json.error);
    } catch (err) {
      setNotice(authFailMessage(err));
    } finally {
      if (!leaving) setLoading(false);
    }
  }

  const title = useMemo(() => {
    if (mode === "definir") return "Defina sua senha";
    if (mode === "recover") return "Recuperar senha";
    if (mode === "signup") return "Criar conta";
    return paying ? "Entre para pagar" : "Entrar com o e-mail";
  }, [mode, paying]);

  const subtitle = useMemo(() => {
    if (mode === "definir") return "Escolha uma senha para os próximos acessos.";
    if (mode === "recover") return COPY.loginRecover;
    if (paying) return "Entre para concluir o pagamento. E-mail e senha, ou Google.";
    return COPY.loginSub;
  }, [mode, paying]);

  const submitLabel = loading
    ? mode === "signup"
      ? "Criando…"
      : mode === "recover"
        ? "Enviando…"
        : mode === "definir"
          ? "Salvando…"
          : "Entrando…"
    : mode === "signup"
      ? "Criar conta"
      : mode === "recover"
        ? "Enviar e-mail"
        : mode === "definir"
          ? "Salvar senha"
          : "Entrar";

  const showTabs = mode === "login" || mode === "signup";
  const showGoogle = mode === "login" || mode === "signup";
  const showPassword = mode !== "recover";
  const showConfirm = mode === "signup" || mode === "definir";

  return (
    <div className="relative h-svh overflow-hidden">
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

      <div className="grid h-full overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden min-h-0 flex-col justify-between px-12 py-12 lg:flex lg:px-16">
          <h1 className="w-fit">
            <BrandLogo
              variant="endorsed"
              className="h-10 w-auto text-[2.5rem]"
              priority
            />
          </h1>

          <div className="max-w-xl">
            <StartingLights
              litCount={litCount}
              phase={phase}
              className="mb-8"
            />
            <p className="max-w-md text-lg text-podium-gray">
              {COPY.loginPainel}
            </p>
          </div>

          <span />
        </section>

        <aside className="relative flex h-full min-h-0 flex-col justify-center overflow-hidden border-white/10 bg-black/35 backdrop-blur-2xl lg:border-l">
          <div className="absolute inset-x-0 top-0 h-1 bg-[repeating-conic-gradient(#0b1a2e_0%_25%,#f5b301_0%_50%)] bg-[length:10px_10px] opacity-80" />
          <div className="w-full px-6 py-8 md:px-12 lg:px-14">
            <div className="mb-6 lg:hidden">
              <h1 className="w-fit">
                <BrandLogo
                  variant="endorsed"
                  className="h-9 w-auto text-[2.25rem]"
                  priority
                />
              </h1>
              <StartingLights
                litCount={litCount}
                phase={phase}
                className="mt-5"
              />
            </div>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-podium-yellow">
                Acesso
              </p>
              <h2 className="text-2xl font-extrabold">{title}</h2>
            </div>
            {showTabs ? (
              <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                    mode === "login"
                      ? "bg-podium-yellow text-podium-navy"
                      : "text-podium-muted hover:text-podium-white"
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                    mode === "signup"
                      ? "bg-podium-yellow text-podium-navy"
                      : "text-podium-muted hover:text-podium-white"
                  }`}
                >
                  Criar conta
                </button>
              </div>
            ) : null}
            <p className="text-sm text-podium-muted">{subtitle}</p>
            <form onSubmit={enter} className="mt-6 space-y-4">
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
                <p className="text-sm text-podium-yellow">{notice}</p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-podium-yellow py-3.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110 disabled:opacity-60"
              >
                {submitLabel}
              </button>
              {showGoogle ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void google()}
                  className="w-full rounded-xl border border-white/15 py-3 text-sm font-medium text-podium-gray transition hover:border-white/30 hover:text-podium-white disabled:opacity-60"
                >
                  Continuar com Google
                </button>
              ) : null}
            </form>
            {mode === "login" ? (
              <button
                type="button"
                onClick={() => switchMode("recover")}
                className="mt-4 text-sm text-podium-muted hover:text-podium-white"
              >
                Esqueci a senha
              </button>
            ) : null}
            {mode === "recover" || mode === "definir" ? (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="mt-4 text-sm text-podium-muted hover:text-podium-white"
              >
                Voltar ao login
              </button>
            ) : null}
            {showTabs ? (
              <p className="mt-5 text-sm text-podium-muted">
                {COPY.loginAluno}{" "}
                <Link
                  href="/pagar?sku=membro_plataforma"
                  className="text-podium-gray underline-offset-2 hover:text-podium-white hover:underline"
                >
                  Ativar cupom
                </Link>
              </p>
            ) : null}
            <Link
              href={BACK.inicio.href}
              className="mt-6 inline-block text-sm text-podium-muted hover:text-podium-white"
            >
              ← {BACK.inicio.label}
            </Link>
          </div>
        </aside>
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

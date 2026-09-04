"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app_error", error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-white/10 bg-black/40 p-8 text-center backdrop-blur-xl">
        <p className="text-balance text-lg font-bold">Não deu para carregar.</p>
        <p className="mt-3 text-pretty text-sm text-podium-gray">
          Tente de novo em instantes.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-podium-yellow px-5 py-2.5 text-sm font-extrabold text-podium-navy transition hover:brightness-110"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

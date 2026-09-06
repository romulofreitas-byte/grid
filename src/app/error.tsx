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
      <div className="max-w-md rounded-md border border-white/10 bg-black/40 p-3 text-center backdrop-blur-xl">
        <p className="text-balance text-base font-semibold">Não deu para carregar.</p>
        <p className="mt-2 text-pretty text-sm text-podium-gray">
          Tente de novo em instantes.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 inline-flex h-8 items-center rounded-md bg-gradient-to-b from-[#ffc933] to-podium-yellow px-3 text-xs font-medium text-podium-navy transition hover:brightness-110"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}

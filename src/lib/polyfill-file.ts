import { File as NodeFile } from "node:buffer";

/** undici 7 asserts `File` at import time; Node 18 does not expose it as a global. */
export function polyfillFileGlobal(): void {
  if (typeof globalThis.File === "undefined") {
    Object.defineProperty(globalThis, "File", {
      value: NodeFile,
      configurable: true,
      writable: true,
    });
  }
}

polyfillFileGlobal();

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  exitAppFullscreen,
  FOCUS_MD_QUERY,
  focusFullscreenDelayMs,
  prefersFocusReduceMotion,
  readFullscreenElement,
  requestAppFullscreen,
} from "@/lib/focus-mode";

type FocusModeValue = {
  on: boolean;
  startedAt: number | null;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
};

const FocusModeContext = createContext<FocusModeValue | null>(null);

export function useFocusMode() {
  const ctx = useContext(FocusModeContext);
  if (!ctx) {
    throw new Error("useFocusMode must be used within FocusModeProvider");
  }
  return ctx;
}

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const onRef = useRef(false);
  const fsTimer = useRef<number | null>(null);

  const clearFsTimer = useCallback(() => {
    if (fsTimer.current == null) return;
    window.clearTimeout(fsTimer.current);
    fsTimer.current = null;
  }, []);

  const exit = useCallback(() => {
    onRef.current = false;
    clearFsTimer();
    setStartedAt(null);
    setOn(false);
    void exitAppFullscreen();
  }, [clearFsTimer]);

  const enter = useCallback(() => {
    if (typeof window !== "undefined" && !window.matchMedia(FOCUS_MD_QUERY).matches) {
      return;
    }
    onRef.current = true;
    setStartedAt(Date.now());
    setOn(true);
    clearFsTimer();
    const delay = focusFullscreenDelayMs(prefersFocusReduceMotion());
    fsTimer.current = window.setTimeout(() => {
      fsTimer.current = null;
      if (!onRef.current) return;
      void requestAppFullscreen();
    }, delay);
  }, [clearFsTimer]);

  const toggle = useCallback(() => {
    if (on) exit();
    else enter();
  }, [on, enter, exit]);

  useEffect(() => {
    function onFsChange() {
      if (typeof document === "undefined") return;
      if (!readFullscreenElement(document)) {
        onRef.current = false;
        clearFsTimer();
        setStartedAt(null);
        setOn(false);
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, [clearFsTimer]);

  useEffect(() => {
    const mq = window.matchMedia(FOCUS_MD_QUERY);
    function onMq() {
      if (!mq.matches) exit();
    }
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, [exit]);

  useEffect(() => () => clearFsTimer(), [clearFsTimer]);

  const value = useMemo(
    () => ({ on, startedAt, enter, exit, toggle }),
    [on, startedAt, enter, exit, toggle],
  );

  return (
    <FocusModeContext.Provider value={value}>{children}</FocusModeContext.Provider>
  );
}

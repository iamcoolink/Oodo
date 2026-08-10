"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Thread } from "@/components/thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { PermissionDesigner } from "@/components/permission-designer";
import { Toaster } from "@/components/ui/sonner";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n";

const MIN_LEFT_WIDTH = 320;
const MAX_LEFT_WIDTH = 700;
const DEFAULT_LEFT_WIDTH = 360;

export default function OdooPermissionStudioPage(): React.ReactNode {
  const { t, language, setLanguage } = useI18n();
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("odoo-permission-studio.left-width");
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        setLeftWidth(Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, parsed)));
      }
    }
  }, []);

  const handleResizeStart = useCallback(() => {
    let lastX = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - lastX;
      lastX = event.clientX;
      setLeftWidth((prev) => {
        const next = Math.max(
          MIN_LEFT_WIDTH,
          Math.min(MAX_LEFT_WIDTH, prev + delta),
        );
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    const handleFirstMove = (event: MouseEvent) => {
      lastX = event.clientX;
      document.removeEventListener("mousemove", handleFirstMove);
      document.addEventListener("mousemove", handleMouseMove);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleFirstMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    localStorage.setItem("odoo-permission-studio.left-width", String(leftWidth));
  }, [leftWidth]);

  if (!mounted) {
    return <div className="p-6">{t("page.loading")}</div>;
  }

  return (
    <React.Suspense fallback={<div className="p-6">{t("page.loading")}</div>}>
      <Toaster />
      <ThreadProvider>
        <StreamProvider>
          <ArtifactProvider>
            <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-100">
              <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#714B67] text-white shadow-sm">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold">
                      {t("page.title")}
                    </h1>
                    <p className="truncate text-xs text-slate-500">
                      {t("page.subtitle")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setLanguage("zh")}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                      language === "zh"
                        ? "bg-white text-[#714B67] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    中文
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("en")}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                      language === "en"
                        ? "bg-white text-[#714B67] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    EN
                  </button>
                </div>
              </header>
              <main className="flex min-h-0 flex-1 overflow-hidden">
                <section
                  className="h-full min-h-0 min-w-0 shrink-0 border-r bg-white"
                  style={{ width: leftWidth }}
                >
                  <Thread />
                </section>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={handleResizeStart}
                  className="relative z-10 w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-violet-400 active:bg-violet-500"
                />
                <section className="hidden min-h-0 min-w-0 flex-1 xl:block">
                  <PermissionDesigner />
                </section>
                <section className="flex flex-1 items-center justify-center p-8 text-center xl:hidden">
                  <div className="max-w-md rounded-2xl border bg-white p-6 shadow-sm">
                    <h1 className="text-lg font-semibold">{t("page.wideWindowTitle")}</h1>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("page.wideWindowMessage")}
                    </p>
                  </div>
                </section>
              </main>
            </div>
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Thread } from "@/components/thread";
import { ArtifactProvider } from "@/components/thread/artifact";
import { PermissionDesigner } from "@/components/permission-designer";
import { Toaster } from "@/components/ui/sonner";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";

const MIN_LEFT_WIDTH = 320;
const MAX_LEFT_WIDTH = 700;
const DEFAULT_LEFT_WIDTH = 360;

export default function OdooPermissionStudioPage(): React.ReactNode {
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);

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

  return (
    <React.Suspense fallback={<div className="p-6">正在加载工作区…</div>}>
      <Toaster />
      <ThreadProvider>
        <StreamProvider>
          <ArtifactProvider>
            <main className="flex h-screen min-h-0 overflow-hidden bg-slate-100">
              <section
                className="min-h-0 min-w-0 shrink-0 border-r bg-white"
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
                  <h1 className="text-lg font-semibold">权限设计画布需要更宽的窗口</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    请将浏览器窗口扩展到 1280px 以上。聊天功能仍可在当前窗口使用。
                  </p>
                </div>
              </section>
            </main>
          </ArtifactProvider>
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}

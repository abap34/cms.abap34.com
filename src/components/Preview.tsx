"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface AlmoModule {
  cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: unknown[]) => unknown;
  lengthBytesUTF8: (str: string) => number;
  stringToUTF8: (str: string, ptr: number, maxBytes: number) => void;
  UTF8ToString: (ptr: number) => string;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
}

interface PreviewProps {
  markdown: string;
}

let modulePromise: Promise<AlmoModule> | null = null;
let cssLoaded = false;

function loadPreviewCSS() {
  if (cssLoaded) return;
  cssLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/almo/preview.css";
  document.head.appendChild(link);
}

function loadAlmoModule(): Promise<AlmoModule> {
  if (modulePromise) return modulePromise;
  modulePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/almo/almo.js";
    script.onload = () => {
      const AlmoModule = (window as unknown as Record<string, unknown>)["AlmoModule"] as (opts?: object) => Promise<AlmoModule>;
      AlmoModule()
        .then(resolve)
        .catch(reject);
    };
    script.onerror = () => {
      modulePromise = null;
      reject(new Error("Failed to load almo.js"));
    };
    document.head.appendChild(script);
  });
  return modulePromise;
}

export function Preview({ markdown }: PreviewProps) {
  const [html, setHtml] = useState("");
  const [wasmAvailable, setWasmAvailable] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const moduleRef = useRef<AlmoModule | null>(null);

  useEffect(() => {
    loadPreviewCSS();
    loadAlmoModule()
      .then((mod) => {
        moduleRef.current = mod;
        setWasmAvailable(true);
      })
      .catch(() => {
        setWasmAvailable(false);
      });
  }, []);

  const render = useCallback(
    async (md: string) => {
      const mod = moduleRef.current;
      if (mod) {
        const byteLen = mod.lengthBytesUTF8(md) + 1;
        const ptr = mod._malloc(byteLen);
        mod.stringToUTF8(md, ptr, byteLen);
        const resultPtr = mod.cwrap("almo_render", "number", ["number", "number"])(ptr, byteLen - 1) as number;
        const result = mod.UTF8ToString(resultPtr);
        mod._free(ptr);
        return result;
      }
      const escaped = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre style="white-space: pre-wrap; font-family: inherit;">${escaped}</pre>`;
    },
    []
  );

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      render(markdown).then(setHtml);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [markdown, render]);

  return (
    <div className="almo-preview">
      {wasmAvailable === false && (
        <p className="text-xs text-amber-600 mb-2">
          almo wasm が読み込めません。プレーンテキストで表示しています。
        </p>
      )}
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-gray-400 italic">プレビューがここに表示されます</p>
      )}
    </div>
  );
}

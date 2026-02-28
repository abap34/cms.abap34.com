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

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      startup?: { promise: Promise<void> };
    };
    hljs?: {
      highlightElement: (el: HTMLElement) => void;
    };
  }
}

interface PreviewProps {
  markdown: string;
}

let modulePromise: Promise<AlmoModule> | null = null;
let cssLoaded = false;
let externalScriptsLoaded = false;

function loadPreviewCSS() {
  if (cssLoaded) return;
  cssLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/almo/preview.css";
  document.head.appendChild(link);
}

function loadExternalScripts() {
  if (externalScriptsLoaded) return;
  externalScriptsLoaded = true;

  // MathJax
  const mathjax = document.createElement("script");
  mathjax.id = "MathJax-script";
  mathjax.async = true;
  mathjax.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
  document.head.appendChild(mathjax);

  // highlight.js CSS
  const hljsCss = document.createElement("link");
  hljsCss.rel = "stylesheet";
  hljsCss.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/styles/github.min.css";
  document.head.appendChild(hljsCss);

  // highlight.js core
  const hljsScript = document.createElement("script");
  hljsScript.src = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/highlight.min.js";
  hljsScript.onload = () => {
    // Additional languages
    const langs = ["julia", "julia-repl", "scheme", "dockerfile"];
    for (const lang of langs) {
      const s = document.createElement("script");
      s.src = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/languages/${lang}.min.js`;
      document.head.appendChild(s);
    }
    // Lean
    const lean = document.createElement("script");
    lean.src = "https://unpkg.com/highlightjs-lean/dist/lean.min.js";
    document.head.appendChild(lean);
  };
  document.head.appendChild(hljsScript);
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
    loadExternalScripts();
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
        try {
          const byteLen = mod.lengthBytesUTF8(md) + 1;
          const ptr = mod._malloc(byteLen);
          mod.stringToUTF8(md, ptr, byteLen);
          const resultPtr = mod.cwrap("almo_render", "number", ["number", "number"])(ptr, byteLen - 1) as number;
          const result = mod.UTF8ToString(resultPtr);
          mod._free(ptr);
          return result;
        } catch {
          // fall through to plain text
        }
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

  const previewRef = useRef<HTMLDivElement>(null);

  // Run MathJax and highlight.js after HTML is rendered
  useEffect(() => {
    if (!html || !previewRef.current) return;

    // highlight.js
    if (window.hljs) {
      previewRef.current.querySelectorAll<HTMLElement>("pre code").forEach((el) => {
        window.hljs!.highlightElement(el);
      });
    }

    // MathJax
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([previewRef.current]).catch(() => {
        // ignore MathJax errors
      });
    }
  }, [html]);

  return (
    <div className="almo-preview" ref={previewRef}>
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

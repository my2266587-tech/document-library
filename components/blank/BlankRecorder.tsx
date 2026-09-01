"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Mic,
  Square,
  Undo2,
  Trash2,
  Printer,
  ImageDown,
  BookMarked,
  Pencil,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Minimal ambient typing for the Web Speech API (not in lib.dom.d.ts).
// ---------------------------------------------------------------------------
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------------------
// Sentence color cycling — dark, mutually distinct hues on white paper.
// ---------------------------------------------------------------------------
const SENTENCE_HUES = [350, 214, 140, 283, 24, 45, 201, 12];

function colorForIndex(i: number): string {
  const hue = SENTENCE_HUES[i % SENTENCE_HUES.length];
  const cycle = Math.floor(i / SENTENCE_HUES.length);
  const light = Math.max(16, 27 - cycle * 3);
  const sat = 50 + (cycle % 3) * 9;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

// ---------------------------------------------------------------------------
// Decorative left-edge icon rail, matching the מחר אחר letterhead.
// ---------------------------------------------------------------------------
const RAIL_ICONS = [
  { ch: "♡", color: "#a7d6e6" },
  { ch: "~", color: "#7c8a3a" },
  { ch: "◇", color: "#7c8a3a" },
  { ch: "∞", color: "#a7d6e6" },
  { ch: "~", color: "#a7d6e6" },
  { ch: "+", color: "#5a6a2a" },
  { ch: "♡", color: "#a7d6e6" },
  { ch: "∞", color: "#7c8a3a" },
];
const RAIL_ROWS = 34;

type Sentence = { id: number; text: string };
type PageMode = "full" | "card";

let nextId = 1;

export default function BlankRecorder() {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [manualText, setManualText] = useState("");
  const [recording, setRecording] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [micStatus, setMicStatus] = useState("בודק תמיכה בהקלטה בדפדפן…");
  const [micWarn, setMicWarn] = useState(false);
  const [livePreview, setLivePreview] = useState("");
  const [savingImage, setSavingImage] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [pageMode, setPageMode] = useState<PageMode>("full");

  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRecordingRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const sheetRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const cancelledEditRef = useRef(false);

  function sheetRefCallback(key: string) {
    return (el: HTMLDivElement | null) => {
      if (el) sheetRefs.current.set(key, el);
      else sheetRefs.current.delete(key);
    };
  }

  const railCells = useMemo(() => {
    const cells: { key: string; ch: string; color: string; offset: boolean }[] = [];
    for (let r = 0; r < RAIL_ROWS; r++) {
      for (let c = 0; c < 2; c++) {
        const icon = RAIL_ICONS[(r * 2 + c) % RAIL_ICONS.length];
        cells.push({ key: `${r}-${c}`, ch: icon.ch, color: icon.color, offset: c % 2 === 1 });
      }
    }
    return cells;
  }, []);

  function addSentence(raw: string) {
    const clean = raw.trim();
    if (!clean) return;
    setSentences((prev) => [...prev, { id: nextId++, text: clean }]);
  }

  function removeSentence(id: number) {
    setSentences((prev) => prev.filter((s) => s.id !== id));
  }

  function undoLast() {
    setSentences((prev) => prev.slice(0, -1));
  }

  function clearAll() {
    setSentences([]);
  }

  function startEditing(id: number, currentText: string) {
    setEditingId(id);
    setEditText(currentText);
  }

  function commitEdit(id: number) {
    const trimmed = editText.trim();
    setSentences((prev) =>
      trimmed
        ? prev.map((s) => (s.id === id ? { ...s, text: trimmed } : s))
        : prev.filter((s) => s.id !== id)
    );
    setEditingId(null);
  }

  function cancelEditing() {
    cancelledEditRef.current = true;
    setEditingId(null);
  }

  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  // ---- speech recognition setup ----
  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time feature detection on mount
      setMicSupported(false);
      setMicStatus("הדפדפן הזה לא תומך בהקלטה קולית — אפשר להוסיף משפטים בהקלדה למטה.");
      setMicWarn(true);
      return;
    }

    const recognizer = new Ctor();
    recognizer.lang = "he-IL";
    recognizer.continuous = true;
    recognizer.interimResults = true;

    recognizer.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          addSentence(res[0].transcript);
        } else {
          interim += res[0].transcript;
        }
      }
      setLivePreview(interim);
    };

    recognizer.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        wantRecordingRef.current = false;
        setRecording(false);
        setMicStatus("הגישה למיקרופון נחסמה. אפשר להוסיף משפטים בהקלדה למטה.");
        setMicWarn(true);
      } else if (event.error === "no-speech") {
        // benign — recognizer restarts via onend
      } else {
        setMicStatus(`שגיאת הקלטה (${event.error}). אפשר להמשיך בהקלדה.`);
        setMicWarn(true);
      }
    };

    recognizer.onend = () => {
      setLivePreview("");
      if (wantRecordingRef.current && restartAttemptsRef.current < 6) {
        restartAttemptsRef.current++;
        try {
          recognizer.start();
        } catch {
          // already starting/stopping — ignore
        }
      } else if (wantRecordingRef.current) {
        wantRecordingRef.current = false;
        setRecording(false);
        setMicStatus("ההקלטה נעצרה. אפשר להתחיל מחדש או להקליד.");
        setMicWarn(true);
      }
    };

    recognizerRef.current = recognizer;
    setMicStatus("מוכן להקלטה. לחצו על הכפתור ודברו בעברית.");

    return () => {
      wantRecordingRef.current = false;
      recognizer.onresult = null;
      recognizer.onerror = null;
      recognizer.onend = null;
      recognizer.stop();
    };
  }, []);

  function toggleMic() {
    const recognizer = recognizerRef.current;
    if (!recognizer) return;
    if (wantRecordingRef.current) {
      wantRecordingRef.current = false;
      recognizer.stop();
      setRecording(false);
      setMicStatus("ההקלטה נעצרה.");
      setMicWarn(false);
    } else {
      wantRecordingRef.current = true;
      restartAttemptsRef.current = 0;
      try {
        recognizer.start();
        setRecording(true);
        setMicStatus("מאזין… דברו בעברית, כל משפט ינחת על הבלאנק.");
        setMicWarn(false);
      } catch {
        wantRecordingRef.current = false;
        setMicStatus("לא הצלחתי להפעיל את המיקרופון.");
        setMicWarn(true);
      }
    }
  }

  async function captureFrame(el: HTMLDivElement) {
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(el, {
      backgroundColor: "#fffdf8",
      scale: 2,
      useCORS: true,
      onclone: (doc) => {
        doc.querySelectorAll("[data-export-hide]").forEach((node) => node.remove());
        // A sentence mid-edit is an <input>; html2canvas can't paint form
        // control values, so swap it for a plain span with the same text.
        doc.querySelectorAll("input[data-export-swap-text]").forEach((node) => {
          const inputEl = node as HTMLInputElement;
          const span = doc.createElement("span");
          span.textContent = inputEl.value;
          span.style.color = inputEl.style.color;
          inputEl.replaceWith(span);
        });
      },
    });
  }

  function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
    return new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve();
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    });
  }

  async function saveAsImage() {
    if (savingImage) return;
    setSavingImage(true);
    try {
      if (pageMode === "full") {
        const el = sheetRefs.current.get("full");
        if (el) {
          const canvas = await captureFrame(el);
          await downloadCanvas(canvas, "בלאנק-מחר-אחר.png");
        }
      } else {
        const keys = sentences.length > 0 ? sentences.map((s) => `card-${s.id}`) : ["card-empty"];
        for (let i = 0; i < keys.length; i++) {
          const el = sheetRefs.current.get(keys[i]);
          if (!el) continue;
          const canvas = await captureFrame(el);
          const suffix = keys.length > 1 ? `-${i + 1}` : "";
          await downloadCanvas(canvas, `בלאנק-מחר-אחר${suffix}.png`);
          if (i < keys.length - 1) await new Promise((r) => setTimeout(r, 250));
        }
      }
    } finally {
      setSavingImage(false);
    }
  }

  // ---------------------------------------------------------------------
  // One letterhead frame: the בס"ד corner, the rail, a set of sentences,
  // the logo/contact footer and the tags bar. `colorStart` lets a
  // single-sentence card keep the same color it would have had in the
  // full letterhead.
  // ---------------------------------------------------------------------
  function renderFrame(frameSentences: Sentence[], colorStart: number, refKey: string, isCard: boolean) {
    // The letterhead is designed at a natural 700x990px box. A single-sentence
    // card prints at 10.5 x 14.8cm (close to A6) — 990px is ~26.19cm at the
    // CSS reference 96dpi, so zoom 0.56 shrinks the design to fit inside it
    // (a hair under the exact 0.565 ratio, as a rounding safety margin — this
    // must fit within the page height, or the whole last block, the tags
    // bar, gets pushed onto a second physical page). This must be `zoom`,
    // not `transform: scale` — a transform only repaints the box visually
    // and does not affect print pagination, so the content would still be
    // measured at its full 700x990px size and split across pages.
    return (
      <div
        ref={sheetRefCallback(refKey)}
        className={`relative w-full max-w-[700px] flex flex-col overflow-hidden shadow-[0_10px_30px_rgba(20,25,20,0.14)] print:shadow-none ${
          isCard ? "print:w-[700px] print:[zoom:0.56]" : "print:max-w-none print:min-h-screen"
        }`}
        style={{ background: "#fffdf8", minHeight: 990 }}
      >
        <div
          className="absolute top-[22px] right-[26px] z-[3] font-black text-[13px]"
          style={{ color: "#143f3f" }}
        >
          בס&quot;ד
        </div>

        <div className="absolute inset-y-0 right-auto left-0 w-[74px] overflow-hidden z-[1] pt-[18px]">
          <div className="grid grid-cols-2 gap-x-[14px] gap-y-[26px]">
            {railCells.map((cell) => (
              <span
                key={cell.key}
                className={`block text-center text-[19px] leading-none ${cell.offset ? "translate-y-5" : ""}`}
                style={{ color: cell.color }}
              >
                {cell.ch}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-[2] flex-1 pt-[78px] pb-[30px] pr-[46px] pl-[110px]">
          {frameSentences.length === 0 ? (
            <p className="italic text-[15px] leading-[1.9]" style={{ color: "#b9b6a8" }} data-export-hide>
              כאן ינחתו המשפטים שמקליטים או מקלידים — כל אחד בגוון כהה משלו.
            </p>
          ) : (
            frameSentences.map((s, i) => {
              const color = colorForIndex(colorStart + i);
              const isEditing = editingId === s.id;
              return (
                <p
                  key={s.id}
                  className="group relative text-[15px] leading-[2] font-semibold mb-5 text-right pl-14"
                  style={{ color }}
                >
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitEdit(s.id);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEditing();
                        }
                      }}
                      onBlur={() => {
                        if (cancelledEditRef.current) {
                          cancelledEditRef.current = false;
                          return;
                        }
                        commitEdit(s.id);
                      }}
                      data-export-swap-text
                      className="w-full bg-transparent border-b border-dashed outline-none text-right font-semibold text-[15px]"
                      style={{ color, borderColor: color }}
                    />
                  ) : (
                    <span
                      onClick={() => startEditing(s.id, s.text)}
                      title="לחיצה לעריכה"
                      className="cursor-text rounded px-0.5 -mx-0.5 hover:bg-black/5 transition"
                    >
                      {s.text}
                    </span>
                  )}
                  {!isEditing && (
                    <span className="absolute left-0 top-0 flex items-center gap-0.5" data-export-hide>
                      <button
                        type="button"
                        onClick={() => startEditing(s.id, s.text)}
                        aria-label="עריכת המשפט"
                        className="p-1 rounded opacity-0 group-hover:opacity-100 transition text-muted hover:text-accent-hover hover:bg-black/5"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSentence(s.id)}
                        aria-label="מחיקת המשפט הזה"
                        className="text-[15px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition text-muted hover:text-danger hover:bg-black/5"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </p>
              );
            })
          )}
        </div>

        <div className="relative z-[2] flex items-end justify-between gap-5 pb-[22px] pr-[46px] pl-[110px]">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
                <path
                  d="M2 15c4-9 9-9 13 0s9 9 13 0"
                  stroke="#143f3f"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="26" cy="7" r="4.2" fill="#f2c230" />
              </svg>
              <span className="font-black text-[27px] tracking-tight" style={{ color: "#143f3f" }}>
                מחר אחר
              </span>
            </div>
            <span className="text-[14px] font-semibold" style={{ color: "#7c8a3a" }}>
              לבחור להגשים
            </span>
          </div>
          <div className="flex flex-col gap-0.5 items-start text-left">
            <span className="font-bold text-[15px]" style={{ color: "#143f3f" }}>
              יהודית - פסיכותרפיסטית ומטפלת רגשית
            </span>
            <span className="text-[13.5px]" style={{ color: "#1c5a5a", direction: "ltr", unicodeBidi: "isolate" }}>
              s0548539967@gmail.com • 054-853-9967
            </span>
          </div>
        </div>

        <div
          className="relative z-[2] text-center text-[13.5px] font-semibold py-3 px-5"
          style={{ background: "#e9e0cb", color: "#143f3f", letterSpacing: ".2px" }}
        >
          EFT ~ NLP ~ תרפיה באומנות ~ דמיון מודרך ~ קלפים טיפוליים ~ קואוצ&apos;ינג ועוד
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <style>
        {pageMode === "card"
          ? "@page { size: 10.5cm 14.8cm; margin: 0; }"
          : "@page { size: A4; margin: 12mm; }"}
      </style>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 print:p-0 print:max-w-none">
        <header className="mb-8 print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition mb-4"
          >
            <ArrowRight className="size-4" />
            חזרה לספרייה
          </Link>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-accent text-white flex items-center justify-center shadow-sm">
              <BookMarked className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground leading-tight">
                בלאנק מוקלט
              </h1>
              <p className="text-muted mt-1 text-sm lg:text-base">
                מקלידים או מקליטים משפט, והוא נוחת על הבלאנק של מחר אחר בצבע כהה משלו — אפשר גם ללחוץ על משפט כדי לערוך אותו
              </p>
            </div>
          </div>
        </header>

        {/* Toolbar */}
        <div className="mb-8 bg-surface border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleMic}
              disabled={!micSupported}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white shadow-sm transition ${
                recording ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent-hover"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
              {recording ? "עצירת הקלטה" : "התחלת הקלטה"}
            </button>
            <span className={`text-sm flex-1 min-w-[220px] ${micWarn ? "text-danger" : "text-muted"}`}>
              {micStatus}
            </span>
          </div>

          {livePreview && (
            <div className="text-sm italic text-muted">{livePreview}</div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSentence(manualText);
                  setManualText("");
                }
              }}
              placeholder="אפשר גם להקליד משפט וללחוץ Enter…"
              maxLength={200}
              className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition"
            />
            <button
              type="button"
              onClick={() => {
                addSentence(manualText);
                setManualText("");
              }}
              className="px-4 py-2 rounded-lg bg-accent-soft text-accent-hover font-medium border border-border hover:bg-accent hover:text-white hover:border-accent transition"
            >
              הוספה
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-sm text-muted">גודל דף:</span>
            <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
              <button
                type="button"
                onClick={() => setPageMode("full")}
                aria-pressed={pageMode === "full"}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  pageMode === "full" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                בלאנק מלא
              </button>
              <button
                type="button"
                onClick={() => setPageMode("card")}
                aria-pressed={pageMode === "card"}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  pageMode === "card" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                כרטיס למשפט (10.5×14.8 ס״מ)
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={undoLast}
              disabled={sentences.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted border border-border hover:text-foreground hover:border-border-strong transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 className="size-4" />
              ביטול אחרון
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={sentences.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted border border-border hover:text-danger hover:border-danger/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="size-4" />
              ניקוי הכל
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-accent-hover border border-accent/40 hover:bg-accent hover:text-white hover:border-accent transition"
            >
              <Printer className="size-4" />
              הדפסה / PDF
            </button>
            <button
              type="button"
              onClick={saveAsImage}
              disabled={savingImage}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-accent-hover border border-accent/40 hover:bg-accent hover:text-white hover:border-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ImageDown className="size-4" />
              {savingImage ? "מכין תמונה…" : "שמירה כתמונה"}
            </button>
          </div>
        </div>

        {/* The letterhead sheet(s) */}
        {pageMode === "full" ? (
          <div className="flex justify-center print:block">
            {renderFrame(sentences, 0, "full", false)}
          </div>
        ) : sentences.length === 0 ? (
          <div className="flex justify-center print:block">
            {renderFrame([], 0, "card-empty", true)}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-8 print:block print:gap-0">
            {sentences.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center print:block print:break-after-page">
                <span className="text-xs text-muted mb-2 print:hidden">
                  כרטיס {i + 1} מתוך {sentences.length} · 10.5×14.8 ס״מ בהדפסה
                </span>
                <div className="flex justify-center print:block">
                  {renderFrame([s], i, `card-${s.id}`, true)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

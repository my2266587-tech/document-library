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

let nextId = 1;

export default function BlankRecorder() {
  const [sentences, setSentences] = useState<{ id: number; text: string }[]>([]);
  const [manualText, setManualText] = useState("");
  const [recording, setRecording] = useState(false);
  const [micSupported, setMicSupported] = useState(true);
  const [micStatus, setMicStatus] = useState("בודק תמיכה בהקלטה בדפדפן…");
  const [micWarn, setMicWarn] = useState(false);
  const [livePreview, setLivePreview] = useState("");
  const [savingImage, setSavingImage] = useState(false);

  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRecordingRef = useRef(false);
  const restartAttemptsRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);

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

  async function saveAsImage() {
    const sheet = sheetRef.current;
    if (!sheet || savingImage) return;
    setSavingImage(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(sheet, {
        backgroundColor: "#fffdf8",
        scale: 2,
        useCORS: true,
        onclone: (doc) => {
          doc.querySelectorAll("[data-export-hide]").forEach((el) => el.remove());
        },
      });
      canvas.toBlob((blob) => {
        if (!blob) {
          setSavingImage(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "בלאנק-מחר-אחר.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setSavingImage(false);
      }, "image/png");
    } catch {
      setSavingImage(false);
    }
  }

  return (
    <div className="min-h-screen bg-background print:bg-white">
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
                מקלידים או מקליטים משפט, והוא נוחת על הבלאנק של מחר אחר בצבע כהה משלו
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

        {/* The letterhead sheet */}
        <div className="flex justify-center print:block">
          <div
            ref={sheetRef}
            className="relative w-full max-w-[700px] flex flex-col overflow-hidden shadow-[0_10px_30px_rgba(20,25,20,0.14)] print:shadow-none print:max-w-none print:min-h-screen"
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
              {sentences.length === 0 ? (
                <p className="italic text-[15px] leading-[1.9]" style={{ color: "#b9b6a8" }} data-export-hide>
                  כאן ינחתו המשפטים שמקליטים או מקלידים — כל אחד בגוון כהה משלו.
                </p>
              ) : (
                sentences.map((s, i) => (
                  <p
                    key={s.id}
                    className="group relative text-[20px] leading-[1.85] font-semibold mb-2.5 text-right pe-6"
                    style={{ color: colorForIndex(i) }}
                  >
                    {s.text}
                    <button
                      type="button"
                      onClick={() => removeSentence(s.id)}
                      aria-label="מחיקת המשפט הזה"
                      data-export-hide
                      className="absolute -start-1 top-0.5 text-[15px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition text-muted hover:text-danger hover:bg-black/5"
                    >
                      ×
                    </button>
                  </p>
                ))
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
        </div>
      </div>
    </div>
  );
}

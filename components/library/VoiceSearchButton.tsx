"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";
import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from "@/lib/speech";
import { useToast } from "./Toast";

const noSubscribe = () => () => {};

// Microphone button for the search box: listens to one spoken sentence in
// Hebrew and writes it into the search as it is heard. Hidden in browsers
// without speech recognition (e.g. Firefox).
export default function VoiceSearchButton({
  onText,
  onListeningChange,
}: {
  onText: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
}) {
  const toast = useToast();
  const supported = useSyncExternalStore(
    noSubscribe,
    () => getSpeechRecognitionCtor() !== null,
    () => false
  );
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop listening if the search box goes away (e.g. leaving the page).
  useEffect(() => {
    return () => {
      const r = recognizerRef.current;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.stop();
      }
    };
  }, []);

  function setListeningBoth(value: boolean) {
    setListening(value);
    onListeningChange?.(value);
  }

  function start() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognizer = new Ctor();
    recognizer.lang = "he-IL";
    recognizer.continuous = false;
    recognizer.interimResults = true;

    recognizer.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      onText(text.trim());
    };
    recognizer.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.show("error", "הגישה למיקרופון חסומה. יש לאשר מיקרופון בהגדרות הדפדפן ולנסות שוב.");
      } else if (event.error === "no-speech") {
        toast.show("info", "לא שמעתי כלום. נסי שוב ודברי קרוב למיקרופון.");
      } else if (event.error !== "aborted") {
        toast.show("error", "החיפוש הקולי לא הצליח. נסי שוב או הקלידי.");
      }
    };
    recognizer.onend = () => {
      recognizerRef.current = null;
      setListeningBoth(false);
    };

    try {
      recognizer.start();
      recognizerRef.current = recognizer;
      setListeningBoth(true);
    } catch {
      toast.show("error", "לא הצלחתי להפעיל את המיקרופון.");
    }
  }

  function toggle() {
    if (recognizerRef.current) recognizerRef.current.stop();
    else start();
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      aria-label={listening ? "עצירת החיפוש הקולי" : "חיפוש קולי"}
      title={listening ? "עצירה" : "חיפוש קולי — לחצי ודברי"}
      className={`absolute end-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center size-11 rounded-lg transition ${
        listening ? "text-danger animate-pulse" : "text-muted hover:text-accent-hover"
      }`}
    >
      {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
    </button>
  );
}

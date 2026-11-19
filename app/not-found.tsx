import Link from "next/link";
import { BookMarked, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="size-12 mx-auto mb-4 rounded-2xl bg-accent text-white flex items-center justify-center shadow-sm">
          <BookMarked className="size-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">הדף לא נמצא</h1>
        <p className="text-muted mt-2">ייתכן שהקישור שגוי או שהדף הוסר.</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent-hover transition shadow-sm"
        >
          <Home className="size-4" />
          חזרה לדף הבית
        </Link>
      </div>
    </main>
  );
}

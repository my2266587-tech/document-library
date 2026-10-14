"use client";

import type { DuplicateMatch } from "@/lib/duplicates";
import { MATCH_LABELS } from "@/lib/duplicates";
import { formatBytes, formatDate } from "@/lib/utils";

/** Compact list of existing documents that look like the file being uploaded. */
export default function DuplicateMatches({
  matches,
  max = 3,
}: {
  matches: DuplicateMatch[];
  max?: number;
}) {
  const shown = matches.slice(0, max);
  const rest = matches.length - shown.length;
  return (
    <ul className="space-y-1 text-xs text-foreground">
      {shown.map((m) => (
        <li key={m.id} className="min-w-0">
          <span className="font-medium break-words">{m.title}</span>
          <span className="text-muted">
            {" "}
            · {MATCH_LABELS[m.match]} · הועלה {formatDate(m.created_at)} ·{" "}
            {formatBytes(m.file_size)}
            {m.category_name ? ` · ${m.category_name}` : ""}
          </span>
        </li>
      ))}
      {rest > 0 && <li className="text-muted">ועוד {rest} מסמכים דומים</li>}
    </ul>
  );
}

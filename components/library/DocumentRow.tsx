"use client";

import { Eye, Download, Pencil, Trash2 } from "lucide-react";
import type { DocumentWithCategory } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { FileTypeIcon } from "@/lib/file-icons";

type Props = {
  doc: DocumentWithCategory;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function DocumentRow({
  doc,
  onView,
  onDownload,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="group grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-accent-soft/30 transition">
      <FileTypeIcon fileType={doc.file_type} size="sm" />

      {/* Title + filename */}
      <div className="min-w-0">
        <h3 className="font-semibold text-foreground truncate text-sm" title={doc.title}>
          {doc.title}
        </h3>
        <p
          className="text-xs text-muted truncate"
          title={doc.original_file_name}
        >
          {doc.original_file_name}
        </p>
      </div>

      {/* Category */}
      <div className="hidden md:block min-w-0">
        {doc.category ? (
          <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent text-xs font-medium truncate inline-block max-w-full">
            {doc.category.name}
          </span>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </div>

      {/* Size */}
      <div className="hidden md:block text-xs text-muted text-start">
        {formatBytes(doc.file_size)}
      </div>

      {/* Date */}
      <div className="hidden md:block text-xs text-muted">
        {formatDate(doc.created_at)}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <IconBtn onClick={onView} icon={<Eye className="size-4" />} label="צפייה" />
        <IconBtn
          onClick={onDownload}
          icon={<Download className="size-4" />}
          label="הורדה"
        />
        <IconBtn onClick={onEdit} icon={<Pencil className="size-4" />} label="עריכה" />
        <IconBtn
          onClick={onDelete}
          icon={<Trash2 className="size-4" />}
          label="מחיקה"
          danger
        />
      </div>
    </div>
  );
}

function IconBtn({
  onClick,
  icon,
  label,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`size-8 inline-flex items-center justify-center rounded-lg transition ${
        danger
          ? "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          : "text-muted hover:bg-accent-soft hover:text-foreground"
      }`}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

export function DocumentRowHeader() {
  return (
    <div className="hidden md:grid grid-cols-[auto_minmax(0,2.5fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] items-center gap-3 px-4 py-2.5 bg-background border-b border-border-strong text-xs font-semibold text-muted uppercase tracking-wide">
      <span className="size-9" aria-hidden="true" />
      <span>שם המסמך</span>
      <span>קטגוריה</span>
      <span>גודל</span>
      <span>תאריך</span>
      <span className="w-[140px] text-end">פעולות</span>
    </div>
  );
}

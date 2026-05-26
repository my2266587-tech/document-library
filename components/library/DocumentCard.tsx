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

export default function DocumentCard({ doc, onView, onDownload, onEdit, onDelete }: Props) {
  return (
    <article className="group relative bg-surface border border-border rounded-2xl p-4 shadow-[0_1px_2px_rgba(47,42,37,0.04)] hover:shadow-md hover:border-border-strong hover:-translate-y-0.5 transition flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <FileTypeIcon fileType={doc.file_type} size="md" />
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-foreground truncate leading-tight"
            title={doc.title}
          >
            {doc.title}
          </h3>
          <p
            className="text-xs text-muted truncate mt-0.5"
            title={doc.original_file_name}
          >
            {doc.original_file_name}
          </p>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {doc.category && (
          <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent font-medium">
            {doc.category.name}
          </span>
        )}
        {doc.file_type && (
          <span className="px-2 py-0.5 rounded-full bg-background border border-border text-muted uppercase tracking-wide font-medium">
            {doc.file_type}
          </span>
        )}
      </div>

      {/* Notes */}
      {doc.notes && (
        <p className="text-sm text-muted line-clamp-2 leading-snug" title={doc.notes}>
          {doc.notes}
        </p>
      )}

      {/* Footer meta */}
      <div className="flex items-center justify-between text-xs text-muted pt-1">
        <span>{formatDate(doc.created_at)}</span>
        <span>{formatBytes(doc.file_size)}</span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1 pt-3 border-t border-border mt-auto">
        <ActionBtn onClick={onView} icon={<Eye className="size-4" />} label="צפייה" />
        <ActionBtn onClick={onDownload} icon={<Download className="size-4" />} label="הורדה" />
        <ActionBtn onClick={onEdit} icon={<Pencil className="size-4" />} label="עריכה" />
        <ActionBtn
          onClick={onDelete}
          icon={<Trash2 className="size-4" />}
          label="מחיקה"
          danger
        />
      </div>
    </article>
  );
}

function ActionBtn({
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
      className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
        danger
          ? "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          : "text-foreground hover:bg-accent-soft"
      }`}
      title={label}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

"use client";

import { FileText, Eye, Download, Pencil, Trash2 } from "lucide-react";
import type { DocumentWithCategory } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";

type Props = {
  doc: DocumentWithCategory;
  onView: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function DocumentCard({ doc, onView, onDownload, onEdit, onDelete }: Props) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-[0_1px_2px_rgba(47,42,37,0.04)] hover:shadow-md hover:border-border-strong transition flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 size-11 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
          <FileText className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate" title={doc.title}>
            {doc.title}
          </h3>
          <p className="text-xs text-muted truncate" title={doc.original_file_name}>
            {doc.original_file_name}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {doc.category && (
          <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent font-medium">
            {doc.category.name}
          </span>
        )}
        {doc.file_type && (
          <span className="px-2 py-0.5 rounded-full bg-background border border-border text-muted uppercase">
            {doc.file_type}
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-background border border-border text-muted">
          {formatBytes(doc.file_size)}
        </span>
      </div>

      {doc.notes && (
        <p className="text-sm text-muted line-clamp-2" title={doc.notes}>
          {doc.notes}
        </p>
      )}

      <div className="text-xs text-muted">הועלה ב־{formatDate(doc.created_at)}</div>

      <div className="flex items-center gap-1 pt-2 border-t border-border mt-auto">
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
    </div>
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
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

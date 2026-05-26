import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileType2,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  File as FileIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FileKind =
  | "pdf"
  | "word"
  | "excel"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "text"
  | "other";

type IconSpec = {
  Icon: LucideIcon;
  /** background tint */
  bg: string;
  /** icon color */
  fg: string;
  /** short label */
  label: string;
};

const SPECS: Record<FileKind, IconSpec> = {
  pdf:     { Icon: FileText,        bg: "#fbe9e9", fg: "#b03a3a", label: "PDF"   },
  word:    { Icon: FileType2,       bg: "#e3ecf7", fg: "#2b5fa3", label: "Word"  },
  excel:   { Icon: FileSpreadsheet, bg: "#e4f1e6", fg: "#2f7a3d", label: "Excel" },
  image:   { Icon: FileImage,       bg: "#efe6f5", fg: "#714098", label: "Image" },
  video:   { Icon: FileVideo,       bg: "#fdeede", fg: "#a35a17", label: "Video" },
  audio:   { Icon: FileAudio,       bg: "#fdf3df", fg: "#8a6810", label: "Audio" },
  archive: { Icon: FileArchive,     bg: "#ece7df", fg: "#6b5a3d", label: "ZIP"   },
  code:    { Icon: FileCode,        bg: "#e5eef0", fg: "#1f5c66", label: "Code"  },
  text:    { Icon: FileText,        bg: "#eee8df", fg: "#5a4a35", label: "Text"  },
  other:   { Icon: FileIcon,        bg: "#ede7df", fg: "#7a6f63", label: "File"  },
};

export function getFileKind(fileType: string | null | undefined): FileKind {
  if (!fileType) return "other";
  const t = fileType.toLowerCase().trim();

  if (["pdf"].includes(t)) return "pdf";
  if (["doc", "docx", "rtf", "odt"].includes(t)) return "word";
  if (["xls", "xlsx", "csv", "ods", "tsv"].includes(t)) return "excel";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "tif", "tiff", "avif"].includes(t)) return "image";
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(t)) return "video";
  if (["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(t)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(t)) return "archive";
  if (["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "java", "go", "rs", "sql"].includes(t)) return "code";
  if (["txt", "md"].includes(t)) return "text";

  return "other";
}

export function getFileIconSpec(fileType: string | null | undefined): IconSpec {
  return SPECS[getFileKind(fileType)];
}

type Props = {
  fileType: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: { box: "size-9 rounded-lg",   icon: "size-4"   },
  md: { box: "size-11 rounded-xl",  icon: "size-5"   },
  lg: { box: "size-14 rounded-2xl", icon: "size-6"   },
};

export function FileTypeIcon({ fileType, size = "md", className }: Props) {
  const { Icon, bg, fg } = getFileIconSpec(fileType);
  const dims = SIZE[size];
  return (
    <div
      className={`${dims.box} shrink-0 flex items-center justify-center ${className ?? ""}`}
      style={{ backgroundColor: bg, color: fg }}
      aria-hidden="true"
    >
      <Icon className={dims.icon} />
    </div>
  );
}

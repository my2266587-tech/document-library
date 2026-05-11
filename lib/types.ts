export type DocumentCategory = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentItem = {
  id: string;
  title: string;
  original_file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category_id: string | null;
  notes: string | null;
  patient_id: string | null;
  uploaded_by: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type DocumentWithCategory = DocumentItem & {
  category: Pick<DocumentCategory, "id" | "name" | "color"> | null;
};

export type UploadResult = {
  fileName: string;
  ok: boolean;
  documentId?: string;
  error?: string;
};

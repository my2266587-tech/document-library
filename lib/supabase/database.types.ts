export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      document_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_categories"]["Insert"]>;
        Relationships: [];
      };
      documents_library: {
        Row: {
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
        Insert: {
          id?: string;
          title: string;
          original_file_name: string;
          file_path: string;
          file_type?: string | null;
          file_size?: number | null;
          category_id?: string | null;
          notes?: string | null;
          patient_id?: string | null;
          uploaded_by?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents_library"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

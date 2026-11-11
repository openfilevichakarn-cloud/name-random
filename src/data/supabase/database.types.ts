/**
 * Types of the Supabase schema in supabase/migrations. Hand-maintained in the shape the
 * Supabase CLI generates (`supabase gen types typescript`); regenerate and replace this file
 * after changing the schema.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = {
  created_at: string
  updated_at: string
}

export type SchoolRow = {
  id: string
  name: string
  created_at: string
}

export type UserRow = {
  id: string
  school_id: string | null
  display_name: string
  role: 'owner' | 'admin' | 'teacher'
  created_at: string
}

export type ClassroomRow = Timestamps & {
  id: string
  school_id: string
  owner_id: string | null
  name: string
  grade_level: string
  academic_year: string
  color: 'violet' | 'cyan' | 'pink' | 'lime' | 'gold'
  is_demo: boolean
}

export type StudentRow = Timestamps & {
  id: string
  school_id: string
  classroom_id: string
  student_code: string
  number: number
  first_name: string
  last_name: string
  nickname: string
  avatar: string
}

export type SessionRow = {
  id: string
  school_id: string
  user_id: string
  classroom_id: string | null
  classroom_name: string
  source: 'students' | 'numbers'
  rules: Json
  started_at: string
  ended_at: string | null
}

export type ResultRow = {
  id: string
  school_id: string
  user_id: string
  session_id: string
  classroom_id: string | null
  student_id: string | null
  display_name: string
  student_number: number | null
  avatar: string | null
  mode: 'wheel' | 'slot' | 'card' | 'countdown' | 'gacha' | 'team'
  draw_type: 'single' | 'multiple' | 'team'
  draw_index: number
  pick_index: number
  team_index: number | null
  points: number
  meta: Json | null
  created_at: string
}

export type RandomSettingsRow = {
  id: string
  user_id: string
  general: Json
  appearance: Json
  animation: Json
  rules: Json
  display: Json
  features: Json
  updated_at: string
}

export type SoundSettingsRow = {
  id: string
  user_id: string
  enabled: boolean
  master_volume: number
  music_volume: number
  sfx_volume: number
  theme: 'neon' | 'arcade' | 'soft'
  music_mode: 'off' | 'draw' | 'always'
  hover: boolean
  updated_at: string
}

/** Insert shape: columns with a database default become optional. */
type Insertable<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>

type Table<Row, Optional extends keyof Row> = {
  Row: Row
  Insert: Insertable<Row, Optional>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      schools: Table<SchoolRow & { join_code: string }, 'id' | 'created_at'>
      users: Table<UserRow, 'school_id' | 'display_name' | 'role' | 'created_at'>
      classrooms: Table<
        ClassroomRow,
        'id' | 'owner_id' | 'grade_level' | 'academic_year' | 'color' | 'is_demo' | 'created_at' | 'updated_at'
      >
      students: Table<
        StudentRow,
        'id' | 'student_code' | 'last_name' | 'nickname' | 'avatar' | 'created_at' | 'updated_at'
      >
      random_sessions: Table<SessionRow, 'id' | 'classroom_id' | 'classroom_name' | 'rules' | 'started_at' | 'ended_at'>
      random_results: Table<
        ResultRow,
        'id' | 'classroom_id' | 'student_id' | 'student_number' | 'avatar' | 'team_index' | 'points' | 'meta' | 'created_at'
      >
      random_settings: Table<
        RandomSettingsRow,
        'id' | 'general' | 'appearance' | 'animation' | 'rules' | 'display' | 'features' | 'updated_at'
      >
      sound_settings: Table<
        SoundSettingsRow,
        'id' | 'enabled' | 'master_volume' | 'music_volume' | 'sfx_volume' | 'theme' | 'music_mode' | 'hover' | 'updated_at'
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      create_school: {
        Args: { school_name: string; display_name?: string }
        Returns: { school_id: string; school_name_out: string; join_code: string; member_role: string }[]
      }
      join_school: {
        Args: { join_code: string; display_name?: string }
        Returns: { school_id: string; school_name_out: string; member_role: string }[]
      }
      get_join_code: { Args: Record<string, never>; Returns: string }
      regenerate_join_code: { Args: Record<string, never>; Returns: string }
      set_member_role: { Args: { member_id: string; new_role: string }; Returns: undefined }
      replace_classroom_students: {
        Args: { target_classroom: string; new_students: Json }
        Returns: StudentRow[]
      }
      classroom_student_stats: {
        Args: { target_classroom: string; from_ts?: string | null; to_ts?: string | null }
        Returns: { student_id: string; stars: number; picks: number; last_picked_at: string | null }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

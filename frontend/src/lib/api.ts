// CareerLens AI — typed API client with JWT handling.
// Base URL comes from VITE_API_URL (see .env.example) and defaults to the
// Vite dev proxy so `npm run dev` works out of the box.

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export const API_BASE = RAW_BASE.replace(/\/+$/, "");

const TOKEN_KEY = "careerlens_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractDetail(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((e) =>
          e && typeof e === "object" && "msg" in e
            ? String((e as { msg: unknown }).msg)
            : JSON.stringify(e),
        )
        .join("; ");
    }
    return JSON.stringify(d);
  }
  return "Request failed";
}

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts.form ? opts.form : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running on port 8000?");
  }

  if (res.status === 401 && !path.startsWith("/auth/")) {
    setToken(null);
    window.location.href = "/login";
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractDetail(body ?? { detail: text || res.statusText }));
  }
  return body as T;
}

// ---- Shared domain types (mirror backend Pydantic schemas) ----
export interface User {
  id: number;
  full_name: string;
  email: string;
  role: "student" | "admin";
  is_demo: boolean;
  created_at: string;
}
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
export interface StudentProfile {
  id: number;
  user_id: number;
  location: string | null;
  phone: string | null;
  college: string | null;
  degree: string | null;
  branch: string | null;
  graduation_year: number | null;
  current_year: number | null;
  cgpa: number | null;
  semester: number | null;
  subjects: string | null;
  desired_roles: string | null;
  industries: string | null;
  preferred_locations: string | null;
  work_preference: string | null;
  salary_expectation: string | null;
  target_companies: string | null;
  strengths: string | null;
  interests: string | null;
  career_goals: string | null;
  about: string | null;
  onboarding_completed: boolean;
  updated_at?: string;
}
export interface Career {
  id: number;
  name: string;
  category: string;
  description: string;
  required_skills: string[] | Record<string, number>;
  responsibilities: string[];
  roadmap: string[];
  projects: string[];
  interview_topics: string[];
  certifications: string[];
  salary_range: string | null;
  demand_level: string | null;
  growth_potential?: string | null;
  suitability?: number;
}
export interface Skill {
  id: number;
  name: string;
  category: string;
  level: number;
  target_level?: number;
}
export interface SkillGapItem {
  name: string;
  current: number;
  required: number;
  gap: number;
}
export interface SkillGapOut {
  target: string;
  gaps: SkillGapItem[];
  recommendations: string[];
}
export interface DashboardData {
  career_readiness: number;
  ats_score: number;
  skill_score: number;
  interview_readiness: number;
  interview_score: number;
  project_strength: number;
  profile_completeness: number;
  learning_progress: number;
  total_applications: number;
  saved_jobs: number;
  recommended_roles: string[];
  next_actions: string[];
  breakdown: Record<string, number>;
}
export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  work_mode: string;
  salary: string | null;
  job_type: string;
  skills: string[];
  experience_label: string | null;
  description: string;
  industry: string | null;
  posted_on: string | null;
  is_sample?: boolean;
  is_active?: boolean;
  match_score: number;
  saved: boolean;
}
export interface Application {
  id: number;
  job_id: number | null;
  company: string;
  role: string;
  status: string;
  applied_date: string | null;
  deadline: string | null;
  job_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface RoadmapItem {
  id: number;
  month: number;
  title: string;
  description: string;
  category: string;
  status: string;
  deadline: string | null;
  resources: string;
  notes: string | null;
  order_index: number;
}
export interface Roadmap {
  id: number;
  career_path_name: string;
  title: string;
  total_months: number;
  progress: number;
  generated_at: string;
  items: RoadmapItem[];
}
export interface Resume {
  id: number;
  filename: string;
  original_filename?: string;
  ats_score?: number;
  created_at: string;
}
export interface ResumeAnalysis {
  id: number;
  resume_id: number;
  ats_score: number;
  match_score: number;
  categories: Record<string, number>;
  strengths: string[];
  improvements: string[];
  missing_sections: string[];
  keywords_found?: string[];
  recommendations: string[];
  created_at: string;
}
export interface JobMatch {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  recommended_keywords: string[];
  experience_match: number;
  education_match: number;
  role_suitability: string;
  recommendation: string;
  why_match: string[];
  why_not_match: string[];
  what_to_improve: string[];
}
export interface InterviewSession {
  id: number;
  role: string;
  difficulty: string;
  status: string;
  current_index: number;
  interview_type: string;
  started_at: string;
  completed_at: string | null;
  report: string | null;
  questions: {
    id: number;
    order_index: number;
    category: string;
    question: string;
    question_type: string;
    options: string[] | null;
  }[];
}
export interface AptitudeQuestion {
  id: number;
  category: string;
  difficulty: string;
  topic: string;
  question: string;
  options: string[];
}
export interface CodingQuestion {
  id: number;
  title: string;
  description?: string;
  difficulty: string;
  category: string;
  language?: string;
}
export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  created_at: string;
}
export interface UserProject {
  id: number;
  title: string;
  description: string;
  technologies: string[];
  category: string;
  difficulty: string;
  github_url: string | null;
  status: string;
  created_at: string;
}
export interface ProjectIdea {
  title: string;
  difficulty: string;
  category: string;
  technologies: string[];
  problem_statement: string;
  features: string[];
  learning_outcomes: string[];
  estimated_duration: string;
  resume_value: string;
  github_checklist: string[];
}
export interface Achievement {
  id: number;
  title: string;
  achievement_type: string;
  organization: string | null;
  date: string | null;
  description: string | null;
  url: string | null;
}
export interface Certification {
  id: number;
  name: string;
  issuer: string | null;
  issue_date: string | null;
  credential_url: string | null;
  skills: string[];
}

// ---- Admin (Phase B) ----
export interface AdminStats {
  users: { total: number; active: number; admins: number; new_last_7_days: number };
  activity: Record<string, number>;
  content: Record<string, number>;
  recent_users: AdminUser[];
  generated_at: string;
}
export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: "student" | "admin";
  is_active: boolean;
  is_demo: boolean;
  created_at: string;
}
export interface AdminUserList {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}
export interface AdminSettings {
  app_name: string;
  debug: boolean;
  seed_demo_data: boolean;
  database_backend: string;
  cors_origins: string[];
  uploads: { max_size_mb: number; allowed_extensions: string[] };
  ai: {
    provider: string;
    mode: string;
    live_configured: boolean;
    openai_key_present: boolean;
    gemini_key_present: boolean;
    note: string;
  };
  health: { status: string; api: string };
  checked_at: string;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { form }),
};

// ---- Admin convenience wrappers (Phase B) ----
// Thin, typed helpers over the protected /admin/* router. The backend is the
// real security boundary; these only keep the UI code tidy.
export const adminApi = {
  stats: () => api.get<AdminStats>("/admin/stats"),
  settings: () => api.get<AdminSettings>("/admin/settings"),

  users: (params: { q?: string; role?: string; status?: string; page?: number; page_size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.role) qs.set("role", params.role);
    if (params.status) qs.set("status", params.status);
    qs.set("page", String(params.page ?? 1));
    qs.set("page_size", String(params.page_size ?? 10));
    return api.get<AdminUserList>(`/admin/users?${qs.toString()}`);
  },
  updateUser: (id: number, body: { role?: string; is_active?: boolean }) =>
    api.patch<AdminUser>(`/admin/users/${id}`, body),

  careers: () => api.get<Career[]>("/admin/careers"),
  createCareer: (body: Record<string, unknown>) => api.post<Career>("/admin/careers", body),
  updateCareer: (id: number, body: Record<string, unknown>) =>
    api.patch<Career>(`/admin/careers/${id}`, body),
  deleteCareer: (id: number) => api.del<{ deleted: number }>(`/admin/careers/${id}`),

  jobs: () => api.get<Job[]>("/admin/jobs"),
  createJob: (body: Record<string, unknown>) => api.post<Job>("/admin/jobs", body),
  updateJob: (id: number, body: Record<string, unknown>) =>
    api.patch<Job>(`/admin/jobs/${id}`, body),
  deleteJob: (id: number) => api.del<{ deleted: number }>(`/admin/jobs/${id}`),
};

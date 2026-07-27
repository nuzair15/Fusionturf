const API_BASE = import.meta.env.VITE_API_URL || "/api";

class ApiClient {
  private token: string | null = null;
  private adminToken: string | null = null;

  constructor() {
    this.token = localStorage.getItem("token");
    this.adminToken = sessionStorage.getItem("admin_token");
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }

  setAdminToken(token: string | null) {
    this.adminToken = token;
    if (token) {
      sessionStorage.setItem("admin_token", token);
    } else {
      sessionStorage.removeItem("admin_token");
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const authToken = this.adminToken || this.token;
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      if (response.status === 204) return undefined as T;
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  get<T>(path: string, params?: Record<string, string | number | undefined>) {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.set(key, String(value));
      });
    }
    const query = searchParams.toString();
    return this.request<T>(`${path}${query ? `?${query}` : ""}`);
  }

  post<T>(path: string, body?: any) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  patch<T>(path: string, body?: any) {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  // Auth
  async login(email: string, password: string) {
    const res = await this.post<{ user: any; token: string }>("/auth/login", { email, password });
    this.setToken(res.token);
    return res;
  }

  async register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) {
    const res = await this.post<{ user: any; token: string }>("/auth/register", data);
    this.setToken(res.token);
    return res;
  }

  async getMe() {
    return this.get<any>("/auth/me");
  }

  logout() {
    this.setToken(null);
  }

  isAuthenticated() {
    return !!this.token;
  }
}

export const api = new ApiClient();

const API_BASE = import.meta.env.VITE_API_URL || "/api";

class ApiClient {
  private csrfValue = "";
  constructor() {
    // Remove credentials persisted by the v1 client. Authentication now uses
    // Secure HttpOnly cookies, which JavaScript (and injected scripts) cannot read.
    localStorage.removeItem("token");
    sessionStorage.removeItem("admin_token");
  }

  setToken(token: string | null) {
    if (token) localStorage.setItem("fusion_session_hint", "1");
    else localStorage.removeItem("fusion_session_hint");
  }

  private csrfToken() {
    if (this.csrfValue) return this.csrfValue;
    const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("XSRF-TOKEN="));
    return match ? decodeURIComponent(match.slice("XSRF-TOKEN=".length)) : "";
  }

  private async request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (options.method && !["GET", "HEAD"].includes(options.method)) headers["X-XSRF-TOKEN"] = this.csrfToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        cache: options.method && options.method !== "GET" ? undefined : "no-store",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 && !retried && !path.startsWith("/auth/")) {
          const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": this.csrfToken() },
          });
          if (refreshed.ok) {
            const session = await refreshed.json().catch(() => ({}));
            if (session.csrfToken) this.csrfValue = session.csrfToken;
            return this.request<T>(path, options, true);
          }
        }
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        const message = error.error || error.message || `HTTP ${response.status}`;

        // A 401 on a request that WAS sent with a token (as opposed to a
        // login/register attempt, which has no token yet) means the server
        // has rejected it — expired, malformed, or the user behind it was
        // deactivated/role-changed since it was issued. Previously nothing
        // cleared the stale token client-side, so every subsequent request
        // kept resending it and kept failing the same way until the user
        // happened to open dev tools or manually logged out. Clearing it
        // here and telling AuthProvider fixes both the token and the UI
        // state in one place instead of every call site handling its own 401.
        if (response.status === 401 && this.isAuthenticated()) {
          this.clearSessionHint();
          window.dispatchEvent(new CustomEvent("fusion-auth-expired"));
        }

        window.dispatchEvent(new CustomEvent("fusion-api-error", { detail: { message } }));
        throw new Error(message);
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

  post<T>(path: string, body?: any, headers?: Record<string, string>) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body), headers });
  }

  patch<T>(path: string, body?: any) {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  put<T>(path: string, body?: any) {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  // Auth
  async login(email: string, password: string, otp?: string) {
    const res = await this.post<{ user?: any; csrfToken?: string; mfaRequired?: boolean; mfaSetupRequired?: boolean; setupToken?: string }>("/auth/login", { email, password, ...(otp ? { otp } : {}) });
    if (res.csrfToken) this.csrfValue = res.csrfToken;
    if (res.user) this.setToken("cookie-session");
    return res;
  }

  beginMfaSetup(setupToken: string) {
    return this.post<{ secret: string; otpAuthUri: string }>("/auth/mfa/setup", { setupToken });
  }

  confirmMfaSetup(setupToken: string, otp: string) {
    return this.post<{ enrolled: boolean }>("/auth/mfa/confirm", { setupToken, otp });
  }

  async register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) {
    const res = await this.post<{ user: any; csrfToken?: string }>("/auth/register", data);
    if (res.csrfToken) this.csrfValue = res.csrfToken;
    this.setToken("cookie-session");
    return res;
  }

  async getMe() {
    return this.get<any>("/auth/me");
  }

  async bootstrapCsrf() {
    const response = await this.get<{ csrfToken: string }>("/auth/csrf");
    this.csrfValue = response.csrfToken;
  }

  async uploadImage(file: File, uploadUrl = `${API_BASE}/upload`) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(uploadUrl, { method: "POST", body: form, credentials: "include", headers: { "X-XSRF-TOKEN": this.csrfToken() } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "Upload failed");
    return data as { url: string };
  }

  private clearSessionHint() {
    this.setToken(null);
  }

  getGuestBooking<T>(token: string) {
    return this.request<T>("/bookings/guest/manage", { headers: { "X-Guest-Token": token } });
  }

  cancelGuestBooking<T>(token: string, reason?: string) {
    return this.request<T>("/bookings/guest/manage/cancel", { method: "PATCH", body: JSON.stringify({ reason }), headers: { "X-Guest-Token": token } });
  }

  async logout() {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-XSRF-TOKEN": this.csrfToken() },
    }).finally(() => { this.csrfValue = ""; this.clearSessionHint(); });
  }

  isAuthenticated() {
    return localStorage.getItem("fusion_session_hint") === "1";
  }

  fixtureEventStreamUrl(fixtureId: string) {
    return `${API_BASE}/v2/fixtures/${encodeURIComponent(fixtureId)}/events/stream`;
  }
}

export const api = new ApiClient();

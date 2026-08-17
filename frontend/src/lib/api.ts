import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8092/api/v1",
  headers: { "Content-Type": "application/json" },
});

const PUBLIC_PATHS = ["/auth/login", "/auth/refresh"];

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const isPublic = PUBLIC_PATHS.some((p) => config.url?.endsWith(p));
    if (!isPublic) {
      const token = localStorage.getItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const fingerprint = localStorage.getItem("fingerprint");
      if (fingerprint) {
        config.headers["X-Fingerprint"] = fingerprint;
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          if (data.fingerprint) {
            localStorage.setItem("fingerprint", data.fingerprint);
          }
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

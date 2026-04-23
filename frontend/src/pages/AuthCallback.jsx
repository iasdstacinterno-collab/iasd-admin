import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    const session_id = m ? decodeURIComponent(m[1]) : null;
    if (!session_id) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const { data } = await api.post("/auth/session", { session_id });
        if (data.token) localStorage.setItem("cf_token", data.token);
        setUser(data.user);
        // Clean hash and redirect
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch (e) {
        console.error("auth callback failed", e);
        navigate("/login?error=1");
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg" data-testid="auth-callback-loading">
      <div className="text-center">
        <div className="animate-pulse text-brand-ink font-heading text-2xl">Autenticando...</div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Church, Mail, Lock } from "lucide-react";

export default function Login() {
  const { loginWithPassword } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("iasdstacinterno@gmail.com");
  const [password, setPassword] = useState("Admin@2026");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      toast.success("Bem-vindo!");
      nav("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Falha no login");
    } finally { setLoading(false); }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center" data-testid="login-back-home">
          <div className="w-10 h-10 rounded-md bg-brand-terracotta flex items-center justify-center"><Church className="w-5 h-5 text-white" /></div>
          <div className="font-heading font-bold text-xl">ChurchFlow</div>
        </Link>
        <div className="bg-white border border-brand-line rounded-lg p-8">
          <h1 className="font-heading text-2xl font-bold text-brand-ink mb-2">Entrar na sua conta</h1>
          <p className="text-sm text-brand-inkSoft mb-6">Acesse o painel para gerenciar sua igreja.</p>

          <button onClick={googleLogin} type="button" className="w-full border border-brand-line rounded-md py-2.5 flex items-center justify-center gap-3 hover:bg-brand-bg transition-colors mb-4" data-testid="login-google-btn">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.9-.1-1.7-.2-2.4H12v4.6h5.9c-.3 1.4-1.1 2.5-2.3 3.3v2.7h3.7c2.2-2 3.2-4.9 3.2-8.2z"/><path fill="#34A853" d="M12 23c3.2 0 5.9-1 7.8-2.9l-3.7-2.7c-1 .7-2.4 1.1-4.1 1.1-3.1 0-5.8-2.1-6.7-4.9H1.4v3C3.3 20.5 7.3 23 12 23z"/><path fill="#FBBC05" d="M5.3 13.6c-.2-.7-.3-1.4-.3-2.1s.1-1.4.3-2.1v-3H1.4C.5 8.1 0 9.7 0 11.5s.5 3.4 1.4 4.9l3.9-2.8z"/><path fill="#EA4335" d="M12 4.6c1.7 0 3.3.6 4.5 1.7l3.3-3.3C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.5 1.4 6.1l3.9 3c.9-2.8 3.6-4.5 6.7-4.5z"/></svg>
            <span className="text-sm font-medium">Continuar com Google</span>
          </button>
          <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-brand-line" /><span className="text-xs text-brand-inkSoft">ou</span><div className="flex-1 h-px bg-brand-line" /></div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-brand-ink block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-brand-inkSoft" />
                <input data-testid="login-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full pl-10 pr-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-brand-ink block mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-brand-inkSoft" />
                <input data-testid="login-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full pl-10 pr-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" />
              </div>
            </div>
            <button type="submit" disabled={loading} data-testid="login-submit" className="brand-btn-primary w-full">{loading ? "Entrando..." : "Entrar"}</button>
          </form>

          <p className="text-sm text-center text-brand-inkSoft mt-6">
            Nao tem conta? <Link to="/register" className="text-brand-terracotta font-medium" data-testid="login-goto-register">Cadastre-se</Link>
          </p>
        </div>
        <div className="mt-6 bg-white/60 border border-brand-line rounded-md p-4 text-xs text-brand-inkSoft">
          <div className="font-semibold text-brand-ink mb-1">Admin demo</div>
          iasdstacinterno@gmail.com / Admin@2026
        </div>
      </div>
    </div>
  );
}

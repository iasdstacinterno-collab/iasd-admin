import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Church } from "lucide-react";

export default function Register() {
  const { registerWithPassword } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerWithPassword(form);
      toast.success("Conta criada!");
      nav("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Falha no cadastro");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center" data-testid="register-back-home">
          <div className="w-10 h-10 rounded-md bg-brand-terracotta flex items-center justify-center"><Church className="w-5 h-5 text-white" /></div>
          <div className="font-heading font-bold text-xl">ChurchFlow</div>
        </Link>
        <div className="bg-white border border-brand-line rounded-lg p-8">
          <h1 className="font-heading text-2xl font-bold text-brand-ink mb-2">Criar sua conta</h1>
          <p className="text-sm text-brand-inkSoft mb-6">Comece gratis, sem cartao.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-brand-ink block mb-1.5">Nome completo</label>
              <input data-testid="register-name" required value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-brand-ink block mb-1.5">Email</label>
              <input data-testid="register-email" type="email" required value={form.email} onChange={e=>setForm({...form, email: e.target.value})} className="w-full px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-brand-ink block mb-1.5">Senha</label>
              <input data-testid="register-password" type="password" required minLength={6} value={form.password} onChange={e=>setForm({...form, password: e.target.value})} className="w-full px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" />
            </div>
            <button type="submit" disabled={loading} data-testid="register-submit" className="brand-btn-primary w-full">{loading ? "Criando..." : "Criar conta"}</button>
          </form>
          <p className="text-sm text-center text-brand-inkSoft mt-6">Ja tem conta? <Link to="/login" className="text-brand-terracotta font-medium" data-testid="register-goto-login">Entrar</Link></p>
        </div>
      </div>
    </div>
  );
}

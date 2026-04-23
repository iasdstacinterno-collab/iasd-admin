import { Link } from "react-router-dom";
import { Church, Calendar, Users, Vote, BarChart3, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="glass-header fixed top-0 left-0 right-0 z-40">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-logo">
            <div className="w-9 h-9 rounded-md bg-brand-terracotta flex items-center justify-center"><Church className="w-5 h-5 text-white" /></div>
            <div>
              <div className="font-heading font-bold text-brand-ink text-lg leading-none">ChurchFlow</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-brand-sage mt-1">Gestao de Igrejas</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-brand-inkSoft">
            <a href="#recursos" className="hover:text-brand-ink">Recursos</a>
            <a href="#como" className="hover:text-brand-ink">Como funciona</a>
            <a href="#precos" className="hover:text-brand-ink">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-brand-ink hover:text-brand-terracotta" data-testid="landing-login">Entrar</Link>
            <Link to="/register" className="brand-btn-primary text-sm" data-testid="landing-cta-register">Comecar gratis</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-36 pb-20 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-brand-line rounded-full text-xs font-medium text-brand-sage mb-6">
              <Sparkles className="w-3 h-3" /> Multi-igrejas SaaS-ready
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-brand-ink leading-[1.05] mb-6">
              Organize cultos,<br/>
              <span className="text-brand-terracotta">escalas</span> e{" "}
              <span className="text-brand-sage">decisoes</span>{" "}
              com leveza.
            </h1>
            <p className="text-lg text-brand-inkSoft max-w-xl mb-10 leading-relaxed">
              Plataforma completa para gestao moderna de igrejas: liturgia dinamica, escala inteligente, eleicoes internas, modo culto ao vivo e relatorios.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/register" className="brand-btn-primary inline-flex items-center gap-2" data-testid="hero-cta-primary">
                Criar conta gratis <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/login" className="brand-btn-ghost" data-testid="hero-cta-login">Acessar plataforma</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-6 text-sm text-brand-inkSoft">
              {["Sem cartao de credito", "Setup em 2 minutos", "Suporte multi-igrejas"].map(t => (
                <div key={t} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-brand-sage" /> {t}</div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative animate-fade-up">
            <div className="relative rounded-2xl overflow-hidden border border-brand-line shadow-2xl">
              <img src="https://images.unsplash.com/photo-1766524554883-2be2d4880fe3?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200" alt="Igreja moderna" className="w-full h-[520px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur p-5 rounded-lg border border-brand-line">
                <div className="overline mb-2">Proximo culto</div>
                <div className="font-heading text-xl font-bold text-brand-ink">Domingo · 19h30</div>
                <div className="text-sm text-brand-inkSoft mt-1">6 etapas · 12 participantes escalados</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20 px-6 lg:px-10 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <div className="overline mb-3">Tudo em um lugar</div>
            <h2 className="font-heading text-3xl lg:text-4xl font-bold text-brand-ink mb-4">Recursos pensados para comunidade</h2>
            <p className="text-brand-inkSoft">Do cadastro de membros ao modo culto ao vivo, o ChurchFlow cuida dos detalhes para voce focar no que importa.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { i: Users, t: "Gestao de membros", d: "Cadastro completo, cargos e historico de participacao." },
              { i: Calendar, t: "Liturgia dinamica", d: "Templates reutilizaveis, etapas editaveis, reordenacao drag-and-drop." },
              { i: Sparkles, t: "Escala inteligente", d: "Sugestoes automaticas que evitam sobrecarga nos mesmos membros." },
              { i: Vote, t: "Eleicoes internas", d: "Votacao transparente, resultados em tempo real." },
              { i: Church, t: "Multi-igrejas", d: "Gerencie varias congregacoes com isolamento de dados." },
              { i: BarChart3, t: "Relatorios & CSV", d: "Participacao, frequencia por funcao e exportacoes praticas." },
            ].map((f, idx) => (
              <div key={idx} className="brand-card p-8" data-testid={`feature-${idx}`}>
                <div className="w-11 h-11 rounded-md bg-brand-bg border border-brand-line flex items-center justify-center mb-5">
                  <f.i className="w-5 h-5 text-brand-terracotta" />
                </div>
                <h3 className="font-heading text-xl font-semibold text-brand-ink mb-2">{f.t}</h3>
                <p className="text-sm text-brand-inkSoft leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="precos" className="py-20 px-6 lg:px-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="overline mb-3">Comece agora</div>
          <h2 className="font-heading text-3xl lg:text-5xl font-bold text-brand-ink mb-6">Pronto para simplificar a gestao da sua igreja?</h2>
          <p className="text-brand-inkSoft text-lg mb-10 max-w-2xl mx-auto">Crie uma conta e comece a organizar cultos e escalas em minutos. Admin master incluso para testes.</p>
          <Link to="/register" className="brand-btn-primary inline-flex items-center gap-2 text-base px-6 py-3" data-testid="bottom-cta">
            Criar conta gratuita <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="py-10 px-6 lg:px-10 border-t border-brand-line bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-brand-inkSoft">
          <div>© 2026 ChurchFlow. Feito com proposito.</div>
          <div className="flex gap-6">
            <Link to="/login">Entrar</Link>
            <Link to="/register">Criar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

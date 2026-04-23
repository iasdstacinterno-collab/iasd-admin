import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Users, CalendarDays, Building2, Vote, ArrowUpRight } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ churches: 0, members: 0, services: 0, elections: 0 });
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const chs = await api.get("/churches").then(r => r.data);
        let members = 0, services = 0, elections = 0;
        const recentSvc = [];
        for (const c of chs) {
          const [ms, ss, es] = await Promise.all([
            api.get(`/churches/${c.church_id}/members`).then(r => r.data).catch(() => []),
            api.get(`/churches/${c.church_id}/services`).then(r => r.data).catch(() => []),
            api.get(`/churches/${c.church_id}/elections`).then(r => r.data).catch(() => []),
          ]);
          members += ms.length; services += ss.length; elections += es.length;
          ss.slice(0, 5).forEach(s => recentSvc.push({ ...s, church_name: c.name }));
        }
        recentSvc.sort((a,b) => new Date(b.date) - new Date(a.date));
        setStats({ churches: chs.length, members, services, elections });
        setRecent(recentSvc.slice(0, 5));
      } catch {}
    })();
  }, []);

  const cards = [
    { k: "churches", t: "Igrejas", i: Building2, c: "brand-terracotta" },
    { k: "members", t: "Membros", i: Users, c: "brand-sage" },
    { k: "services", t: "Cultos", i: CalendarDays, c: "brand-sand" },
    { k: "elections", t: "Eleicoes", i: Vote, c: "brand-danger" },
  ];

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="mb-10">
        <div className="overline mb-2">Bem-vindo(a)</div>
        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-brand-ink">Ola, {user?.name?.split(" ")[0] || "amigo"}</h1>
        <p className="text-brand-inkSoft mt-2">Um panorama rapido da sua comunidade.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {cards.map(c => {
          const Icon = c.i;
          return (
            <div key={c.k} className="brand-card p-6" data-testid={`stat-${c.k}`}>
              <div className={`w-10 h-10 rounded-md bg-${c.c}/15 flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 text-${c.c}`} />
              </div>
              <div className="text-3xl font-heading font-bold text-brand-ink">{stats[c.k]}</div>
              <div className="text-sm text-brand-inkSoft mt-1">{c.t}</div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="brand-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-bold text-brand-ink">Proximos cultos</h2>
            <Link to="/cultos" className="text-sm text-brand-terracotta flex items-center gap-1 hover:underline" data-testid="see-all-services">
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-brand-inkSoft text-sm py-8 text-center">Nenhum culto agendado.</div>
          ) : (
            <div className="divide-y divide-brand-line">
              {recent.map(s => (
                <Link key={s.service_id} to={`/cultos/${s.service_id}/editor`} className="flex items-center justify-between py-4 hover:bg-brand-bg px-2 rounded transition-colors" data-testid={`recent-${s.service_id}`}>
                  <div>
                    <div className="font-medium text-brand-ink">{s.name}</div>
                    <div className="text-xs text-brand-inkSoft">{s.church_name} · {new Date(s.date).toLocaleString("pt-BR")}</div>
                  </div>
                  <span className="overline">{s.steps?.length || 0} etapas</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="brand-card p-6">
          <h2 className="font-heading text-lg font-bold text-brand-ink mb-4">Acoes rapidas</h2>
          <div className="space-y-3">
            <Link to="/cultos" className="flex items-center justify-between p-3 rounded-md bg-brand-bg hover:bg-brand-sand/30 transition-colors" data-testid="quick-create-service">
              <span className="text-sm font-medium">Novo culto</span><ArrowUpRight className="w-4 h-4 text-brand-inkSoft" />
            </Link>
            <Link to="/membros" className="flex items-center justify-between p-3 rounded-md bg-brand-bg hover:bg-brand-sand/30 transition-colors" data-testid="quick-add-member">
              <span className="text-sm font-medium">Cadastrar membro</span><ArrowUpRight className="w-4 h-4 text-brand-inkSoft" />
            </Link>
            <Link to="/eleicoes" className="flex items-center justify-between p-3 rounded-md bg-brand-bg hover:bg-brand-sand/30 transition-colors" data-testid="quick-new-election">
              <span className="text-sm font-medium">Abrir eleicao</span><ArrowUpRight className="w-4 h-4 text-brand-inkSoft" />
            </Link>
            <Link to="/relatorios" className="flex items-center justify-between p-3 rounded-md bg-brand-bg hover:bg-brand-sand/30 transition-colors" data-testid="quick-reports">
              <span className="text-sm font-medium">Ver relatorios</span><ArrowUpRight className="w-4 h-4 text-brand-inkSoft" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

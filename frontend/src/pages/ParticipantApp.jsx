import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Home, Bell, Calendar, LogOut, CheckCircle2, XCircle } from "lucide-react";

export default function ParticipantApp() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("tasks");
  const [services, setServices] = useState([]);
  const [members, setMembers] = useState([]);
  const [asgs, setAsgs] = useState([]);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    (async () => {
      const chs = await api.get("/churches").then(r => r.data);
      let allSvc = [], allMb = [], allAsg = [];
      for (const c of chs) {
        const svcs = await api.get(`/churches/${c.church_id}/services`).then(r => r.data).catch(()=>[]);
        const mbs = await api.get(`/churches/${c.church_id}/members`).then(r => r.data).catch(()=>[]);
        allSvc.push(...svcs); allMb.push(...mbs);
        for (const s of svcs) {
          const a = await api.get(`/services/${s.service_id}/assignments`).then(r => r.data).catch(()=>[]);
          allAsg.push(...a.map(x => ({ ...x, service: s })));
        }
      }
      setServices(allSvc); setMembers(allMb); setAsgs(allAsg);
      api.get("/notifications").then(r => setNotifs(r.data));
    })();
  }, []);

  // Find member whose email matches user.email
  const myMember = members.find(m => m.email && user?.email && m.email.toLowerCase() === user.email.toLowerCase());
  const myAsgs = myMember ? asgs.filter(a => a.member_id === myMember.member_id) : [];

  const updateStatus = async (aid, status) => {
    await api.patch(`/assignments/${aid}?status=${status}`);
    setAsgs(asgs.map(a => a.assignment_id === aid ? { ...a, status } : a));
    toast.success(status === "confirmado" ? "Presenca confirmada" : "Recusado");
  };

  return (
    <div className="min-h-screen bg-brand-bg pb-24">
      <header className="glass-header sticky top-0 z-30 px-5 h-16 flex items-center justify-between">
        <div className="font-heading font-bold text-brand-ink">Ola, {user?.name?.split(" ")[0]}</div>
        <button onClick={async ()=>{ await logout(); nav("/"); }} className="text-brand-inkSoft" data-testid="participant-logout"><LogOut className="w-5 h-5"/></button>
      </header>

      <div className="max-w-md mx-auto px-5 py-6">
        {tab === "tasks" && (
          <>
            <div className="overline mb-2">Suas tarefas</div>
            <h1 className="font-heading text-2xl font-bold text-brand-ink mb-5">Proximas escalas</h1>
            <div className="space-y-3">
              {myAsgs.length === 0 && <div className="brand-card p-6 text-center text-brand-inkSoft text-sm">Voce nao tem tarefas atribuidas.</div>}
              {myAsgs.map(a => {
                const step = (a.service.steps || []).find(s => s.id === a.step_id);
                return (
                  <div key={a.assignment_id} className="brand-card p-5" data-testid={`p-asg-${a.assignment_id}`}>
                    <div className="overline mb-1">{new Date(a.service.date).toLocaleDateString("pt-BR")}</div>
                    <div className="font-heading font-semibold text-brand-ink text-lg">{a.service.name}</div>
                    <div className="text-sm text-brand-inkSoft">Etapa: {step?.name || "—"}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded capitalize ${a.status === "confirmado" ? "bg-brand-sage/20 text-brand-sage" : a.status === "recusado" ? "bg-brand-danger/20 text-brand-danger" : "bg-brand-sand/40 text-brand-ink"}`}>{a.status}</span>
                      {a.status !== "confirmado" && (
                        <div className="flex gap-2">
                          <button onClick={()=>updateStatus(a.assignment_id, "confirmado")} className="brand-btn-secondary flex items-center gap-1 text-xs px-3 py-1.5" data-testid={`p-confirm-${a.assignment_id}`}><CheckCircle2 className="w-3 h-3"/> Confirmar</button>
                          <button onClick={()=>updateStatus(a.assignment_id, "recusado")} className="brand-btn-ghost flex items-center gap-1 text-xs px-3 py-1.5" data-testid={`p-refuse-${a.assignment_id}`}><XCircle className="w-3 h-3"/> Recusar</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === "services" && (
          <>
            <div className="overline mb-2">Agenda</div>
            <h1 className="font-heading text-2xl font-bold text-brand-ink mb-5">Cultos</h1>
            <div className="space-y-3">
              {services.map(s => (
                <Link key={s.service_id} to={`/cultos/${s.service_id}/live`} className="block brand-card p-5" data-testid={`p-svc-${s.service_id}`}>
                  <div className="overline mb-1">{new Date(s.date).toLocaleDateString("pt-BR")}</div>
                  <div className="font-heading font-semibold text-brand-ink text-lg">{s.name}</div>
                  <div className="text-sm text-brand-inkSoft">{s.steps?.length || 0} etapas</div>
                </Link>
              ))}
            </div>
          </>
        )}
        {tab === "notifs" && (
          <>
            <div className="overline mb-2">Central</div>
            <h1 className="font-heading text-2xl font-bold text-brand-ink mb-5">Notificacoes</h1>
            <div className="space-y-3">
              {notifs.map(n => (
                <div key={n.notification_id} className="brand-card p-4" data-testid={`p-notif-${n.notification_id}`}>
                  <div className="font-medium text-brand-ink text-sm">{n.title}</div>
                  <div className="text-xs text-brand-inkSoft mt-1">{n.body}</div>
                </div>
              ))}
              {notifs.length === 0 && <div className="text-center text-brand-inkSoft text-sm py-12">Sem notificacoes.</div>}
            </div>
          </>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-line">
        <div className="max-w-md mx-auto grid grid-cols-3">
          {[
            { k: "tasks", i: Home, t: "Tarefas" },
            { k: "services", i: Calendar, t: "Cultos" },
            { k: "notifs", i: Bell, t: "Avisos" },
          ].map(x => (
            <button key={x.k} onClick={()=>setTab(x.k)} className={`py-3 flex flex-col items-center gap-1 text-xs ${tab === x.k ? "text-brand-terracotta" : "text-brand-inkSoft"}`} data-testid={`p-tab-${x.k}`}>
              <x.i className="w-5 h-5"/>
              <span>{x.t}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

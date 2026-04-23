import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function Escalas() {
  const [churches, setChurches] = useState([]);
  const [church, setChurch] = useState("");
  const [services, setServices] = useState([]);
  const [members, setMembers] = useState([]);
  const [asgs, setAsgs] = useState({}); // service_id -> list

  useEffect(() => { api.get("/churches").then(r => { setChurches(r.data); if (r.data.length) setChurch(r.data[0].church_id); }); }, []);
  useEffect(() => { if (!church) return; loadAll(); /* eslint-disable-next-line */ }, [church]);

  const loadAll = async () => {
    const [svc, mb] = await Promise.all([
      api.get(`/churches/${church}/services`).then(r => r.data),
      api.get(`/churches/${church}/members`).then(r => r.data),
    ]);
    setServices(svc); setMembers(mb);
    const map = {};
    for (const s of svc) { map[s.service_id] = await api.get(`/services/${s.service_id}/assignments`).then(r => r.data); }
    setAsgs(map);
  };

  const updateStatus = async (aid, status) => {
    await api.patch(`/assignments/${aid}?status=${status}`);
    toast.success("Status atualizado");
    loadAll();
  };

  const memberMap = Object.fromEntries(members.map(m => [m.member_id, m]));
  const statusColor = { pendente: "bg-brand-sand/40 text-brand-ink", confirmado: "bg-brand-sage/25 text-brand-sage", recusado: "bg-brand-danger/20 text-brand-danger" };

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline mb-2">Organizacao</div>
          <h1 className="font-heading text-3xl font-bold text-brand-ink">Escalas</h1>
        </div>
        <select value={church} onChange={e=>setChurch(e.target.value)} className="px-3 py-2 border border-brand-line rounded-md bg-white" data-testid="escalas-church-select">
          {churches.map(c => <option key={c.church_id} value={c.church_id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-6">
        {services.map(s => {
          const list = asgs[s.service_id] || [];
          const stepMap = Object.fromEntries((s.steps||[]).map(st => [st.id, st]));
          return (
            <div key={s.service_id} className="brand-card p-6" data-testid={`escalas-svc-${s.service_id}`}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-heading text-xl font-semibold text-brand-ink">{s.name}</h3>
                  <p className="text-sm text-brand-inkSoft">{new Date(s.date).toLocaleString("pt-BR")}</p>
                </div>
                <div className="text-sm text-brand-inkSoft">{list.length} atribuicoes</div>
              </div>
              {list.length === 0 ? (
                <div className="text-sm text-brand-inkSoft py-4">Sem escalas. Use a sugestao inteligente no editor.</div>
              ) : (
                <div className="divide-y divide-brand-line">
                  {list.map(a => (
                    <div key={a.assignment_id} className="py-3 flex items-center justify-between flex-wrap gap-2" data-testid={`asg-${a.assignment_id}`}>
                      <div>
                        <div className="font-medium text-brand-ink">{memberMap[a.member_id]?.name || "?"}</div>
                        <div className="text-xs text-brand-inkSoft">{stepMap[a.step_id]?.name || "—"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded capitalize ${statusColor[a.status] || ""}`}>{a.status}</span>
                        <div className="flex gap-1">
                          <button onClick={()=>updateStatus(a.assignment_id, "confirmado")} className="text-xs px-2 py-1 border border-brand-line rounded hover:bg-brand-sage/10" data-testid={`confirm-${a.assignment_id}`}>Confirmar</button>
                          <button onClick={()=>updateStatus(a.assignment_id, "recusado")} className="text-xs px-2 py-1 border border-brand-line rounded hover:bg-brand-danger/10" data-testid={`refuse-${a.assignment_id}`}>Recusar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {services.length === 0 && <div className="text-center py-12 text-brand-inkSoft">Nenhum culto cadastrado.</div>}
      </div>
    </div>
  );
}

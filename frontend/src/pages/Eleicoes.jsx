import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Vote as VoteIcon, CheckCircle2 } from "lucide-react";

export default function Eleicoes() {
  const [churches, setChurches] = useState([]);
  const [church, setChurch] = useState("");
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", candidates: "", ends_at: "" });

  useEffect(() => { api.get("/churches").then(r => { setChurches(r.data); if (r.data.length) setChurch(r.data[0].church_id); }); }, []);
  useEffect(() => { if (church) api.get(`/churches/${church}/elections`).then(r => setList(r.data)); }, [church]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title, description: form.description,
        candidates: form.candidates.split(",").map(s=>s.trim()).filter(Boolean),
        ends_at: new Date(form.ends_at).toISOString(),
      };
      if (payload.candidates.length < 2) { toast.error("Informe ao menos 2 candidatos"); return; }
      await api.post(`/churches/${church}/elections`, payload);
      toast.success("Eleicao criada");
      setForm({ title:"", description:"", candidates:"", ends_at:"" }); setShowForm(false);
      api.get(`/churches/${church}/elections`).then(r => setList(r.data));
    } catch { toast.error("Falha"); }
  };

  const vote = async (eid, cand) => {
    try { await api.post(`/elections/${eid}/vote`, { candidate: cand }); toast.success("Voto registrado"); api.get(`/churches/${church}/elections`).then(r => setList(r.data)); }
    catch (e) { toast.error(e?.response?.data?.detail || "Falha"); }
  };

  const closeEl = async (eid) => { await api.post(`/elections/${eid}/close`); api.get(`/churches/${church}/elections`).then(r => setList(r.data)); };

  return (
    <div className="max-w-6xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div><div className="overline mb-2">Decisoes internas</div><h1 className="font-heading text-3xl font-bold text-brand-ink">Eleicoes</h1></div>
        <div className="flex gap-3">
          <select value={church} onChange={e=>setChurch(e.target.value)} className="px-3 py-2 border border-brand-line rounded-md bg-white" data-testid="eleicoes-church-select">
            {churches.map(c => <option key={c.church_id} value={c.church_id}>{c.name}</option>)}
          </select>
          <button onClick={()=>setShowForm(s=>!s)} className="brand-btn-primary flex items-center gap-2" data-testid="new-election-btn" disabled={!church}><Plus className="w-4 h-4"/> Nova</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="brand-card p-6 mb-6 space-y-3" data-testid="election-form">
          <input required placeholder="Titulo" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="w-full px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="election-title"/>
          <textarea placeholder="Descricao" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="w-full px-3 py-2.5 border border-brand-line rounded-md focus:outline-none" rows={2} data-testid="election-description"/>
          <input required placeholder="Candidatos (virgula)" value={form.candidates} onChange={e=>setForm({...form, candidates: e.target.value})} className="w-full px-3 py-2.5 border border-brand-line rounded-md focus:outline-none" data-testid="election-candidates"/>
          <div className="flex gap-3">
            <input required type="datetime-local" value={form.ends_at} onChange={e=>setForm({...form, ends_at: e.target.value})} className="flex-1 px-3 py-2.5 border border-brand-line rounded-md focus:outline-none" data-testid="election-ends"/>
            <button className="brand-btn-primary" data-testid="election-save">Criar</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {list.map(e => {
          const total = e.total_votes || 0;
          return (
            <div key={e.election_id} className="brand-card p-6" data-testid={`election-${e.election_id}`}>
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-brand-sand/30 flex items-center justify-center"><VoteIcon className="w-5 h-5 text-brand-terracotta"/></div>
                  <div>
                    <h3 className="font-heading text-xl font-semibold text-brand-ink">{e.title}</h3>
                    {e.description && <p className="text-sm text-brand-inkSoft">{e.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full ${e.status === "open" ? "bg-brand-sage/20 text-brand-sage" : "bg-brand-line text-brand-inkSoft"}`}>
                    {e.status === "open" ? "Aberta" : "Encerrada"}
                  </span>
                  {e.status === "open" && <button onClick={()=>closeEl(e.election_id)} className="text-xs text-brand-inkSoft hover:text-brand-danger" data-testid={`close-${e.election_id}`}>Encerrar</button>}
                </div>
              </div>
              <div className="space-y-2">
                {e.candidates.map(c => {
                  const v = e.results?.[c] || 0;
                  const pct = total ? Math.round((v/total)*100) : 0;
                  return (
                    <div key={c} className="space-y-1" data-testid={`candidate-${c}`}>
                      <div className="flex items-center justify-between">
                        <button onClick={()=>vote(e.election_id, c)} disabled={e.status!=="open"} className="flex items-center gap-2 text-left hover:text-brand-terracotta disabled:opacity-50" data-testid={`vote-${e.election_id}-${c}`}>
                          <CheckCircle2 className="w-4 h-4 text-brand-inkSoft hover:text-brand-terracotta"/>
                          <span className="font-medium">{c}</span>
                        </button>
                        <span className="text-sm text-brand-inkSoft">{v} votos · {pct}%</span>
                      </div>
                      <div className="h-2 bg-brand-bg rounded-full overflow-hidden">
                        <div className="h-full bg-brand-sage" style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-brand-inkSoft mt-4">Total: {total} · Termina em {new Date(e.ends_at).toLocaleString("pt-BR")}</div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-center py-12 text-brand-inkSoft">Nenhuma eleicao.</div>}
      </div>
    </div>
  );
}

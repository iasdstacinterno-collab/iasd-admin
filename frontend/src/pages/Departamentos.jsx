import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Users, Calendar as CalendarIcon, X } from "lucide-react";

export default function Departamentos() {
  const [churches, setChurches] = useState([]);
  const [church, setChurch] = useState("");
  const [list, setList] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selected, setSelected] = useState(null); // department for schedule
  const [schedule, setSchedule] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, entries: [] });

  useEffect(() => { api.get("/churches").then(r => { setChurches(r.data); if (r.data.length) setChurch(r.data[0].church_id); }); }, []);
  useEffect(() => {
    if (!church) return;
    api.get(`/churches/${church}/departments`).then(r => setList(r.data));
    api.get(`/churches/${church}/members`).then(r => setMembers(r.data));
  }, [church]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/churches/${church}/departments`, form);
      toast.success("Departamento criado");
      setForm({ name: "", description: "" }); setShowForm(false);
      api.get(`/churches/${church}/departments`).then(r => setList(r.data));
    } catch { toast.error("Falha"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir este departamento?")) return;
    await api.delete(`/departments/${id}`);
    setList(list.filter(d => d.department_id !== id));
    if (selected?.department_id === id) setSelected(null);
  };

  const toggleMember = async (dep, memberId) => {
    const ids = dep.member_ids || [];
    const next = ids.includes(memberId) ? ids.filter(x => x !== memberId) : [...ids, memberId];
    await api.patch(`/departments/${dep.department_id}`, { member_ids: next });
    setList(list.map(d => d.department_id === dep.department_id ? { ...d, member_ids: next } : d));
  };

  const openSchedule = async (dep) => {
    setSelected(dep);
    const now = new Date();
    const sch = await api.get(`/departments/${dep.department_id}/schedule?year=${now.getFullYear()}&month=${now.getMonth()+1}`).then(r => r.data);
    setSchedule({ year: sch.year, month: sch.month, entries: sch.entries || [] });
  };

  const loadSchedule = async (year, month) => {
    if (!selected) return;
    const sch = await api.get(`/departments/${selected.department_id}/schedule?year=${year}&month=${month}`).then(r => r.data);
    setSchedule({ year, month, entries: sch.entries || [] });
  };

  const saveSchedule = async () => {
    await api.put(`/departments/${selected.department_id}/schedule`, schedule);
    toast.success("Escala salva");
  };

  const addEntry = () => setSchedule({ ...schedule, entries: [...schedule.entries, { date: `${schedule.year}-${String(schedule.month).padStart(2,"0")}-01`, member_id: "", role: "", notes: "" }] });
  const updateEntry = (i, patch) => setSchedule({ ...schedule, entries: schedule.entries.map((e, idx) => idx === i ? { ...e, ...patch } : e) });
  const removeEntry = (i) => setSchedule({ ...schedule, entries: schedule.entries.filter((_, idx) => idx !== i) });

  const memberMap = Object.fromEntries(members.map(m => [m.member_id, m]));
  const monthNames = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline mb-2">Equipe</div>
          <h1 className="font-heading text-3xl font-bold text-brand-ink">Departamentos</h1>
        </div>
        <div className="flex gap-3">
          <select value={church} onChange={e=>setChurch(e.target.value)} className="px-3 py-2 border border-brand-line rounded-md bg-white" data-testid="dep-church-select">
            {churches.map(c => <option key={c.church_id} value={c.church_id}>{c.name}</option>)}
          </select>
          <button onClick={()=>setShowForm(s=>!s)} className="brand-btn-primary flex items-center gap-2" data-testid="new-department-btn" disabled={!church}>
            <Plus className="w-4 h-4"/> Novo departamento
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="brand-card p-6 mb-6 grid md:grid-cols-3 gap-4" data-testid="department-form">
          <input required placeholder="Nome (ex: Musica)" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="department-name-input"/>
          <input placeholder="Descricao" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="md:col-span-1 px-3 py-2.5 border border-brand-line rounded-md focus:outline-none" data-testid="department-desc-input"/>
          <button className="brand-btn-primary" data-testid="department-save">Salvar</button>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {list.map(dep => (
          <div key={dep.department_id} className="brand-card p-6" data-testid={`department-${dep.department_id}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-heading text-xl font-semibold text-brand-ink">{dep.name}</h3>
                {dep.description && <p className="text-sm text-brand-inkSoft mt-1">{dep.description}</p>}
              </div>
              <button onClick={()=>remove(dep.department_id)} className="text-brand-inkSoft hover:text-brand-danger" data-testid={`del-dep-${dep.department_id}`}><Trash2 className="w-4 h-4"/></button>
            </div>
            <div className="overline mb-2">Membros ({dep.member_ids?.length || 0})</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {members.map(m => {
                const on = (dep.member_ids || []).includes(m.member_id);
                return (
                  <button key={m.member_id} onClick={()=>toggleMember(dep, m.member_id)} className={`text-xs px-2 py-1 rounded transition-colors ${on ? "bg-brand-sage text-white" : "bg-brand-bg border border-brand-line text-brand-inkSoft hover:border-brand-sage"}`} data-testid={`dep-mem-${dep.department_id}-${m.member_id}`}>
                    {m.name}
                  </button>
                );
              })}
              {members.length === 0 && <span className="text-xs text-brand-inkSoft">Nenhum membro cadastrado</span>}
            </div>
            <button onClick={()=>openSchedule(dep)} className="brand-btn-ghost w-full flex items-center justify-center gap-2 text-sm" data-testid={`sched-${dep.department_id}`}>
              <CalendarIcon className="w-4 h-4"/> Escala mensal
            </button>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full text-center py-12 text-brand-inkSoft">Nenhum departamento.</div>}
      </div>

      {/* Schedule modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setSelected(null)} data-testid="schedule-modal">
          <div onClick={e=>e.stopPropagation()} className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-brand-line flex items-center justify-between sticky top-0 bg-white">
              <div>
                <div className="overline mb-1">Escala mensal</div>
                <h2 className="font-heading text-2xl font-bold text-brand-ink">{selected.name}</h2>
              </div>
              <button onClick={()=>setSelected(null)} className="p-2 hover:bg-brand-bg rounded" data-testid="close-schedule"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <select value={schedule.month} onChange={e=>loadSchedule(schedule.year, Number(e.target.value))} className="px-3 py-2 border border-brand-line rounded-md bg-white" data-testid="sched-month">
                  {monthNames.map((n, i) => <option key={i} value={i+1}>{n}</option>)}
                </select>
                <input type="number" value={schedule.year} onChange={e=>loadSchedule(Number(e.target.value), schedule.month)} className="w-24 px-3 py-2 border border-brand-line rounded-md" data-testid="sched-year"/>
                <button onClick={addEntry} className="brand-btn-ghost flex items-center gap-2 text-sm ml-auto" data-testid="add-sched-entry"><Plus className="w-4 h-4"/> Entrada</button>
                <button onClick={saveSchedule} className="brand-btn-primary text-sm" data-testid="save-schedule">Salvar</button>
              </div>
              <div className="space-y-2">
                {schedule.entries.map((e, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center" data-testid={`sched-entry-${i}`}>
                    <input type="date" value={e.date} onChange={ev=>updateEntry(i, { date: ev.target.value })} className="col-span-3 px-2 py-2 border border-brand-line rounded text-sm"/>
                    <select value={e.member_id} onChange={ev=>updateEntry(i, { member_id: ev.target.value })} className="col-span-4 px-2 py-2 border border-brand-line rounded text-sm">
                      <option value="">Selecione membro...</option>
                      {(selected.member_ids || []).map(mid => memberMap[mid]).filter(Boolean).map(m => <option key={m.member_id} value={m.member_id}>{m.name}</option>)}
                    </select>
                    <input placeholder="Funcao" value={e.role || ""} onChange={ev=>updateEntry(i, { role: ev.target.value })} className="col-span-2 px-2 py-2 border border-brand-line rounded text-sm"/>
                    <input placeholder="Notas" value={e.notes || ""} onChange={ev=>updateEntry(i, { notes: ev.target.value })} className="col-span-2 px-2 py-2 border border-brand-line rounded text-sm"/>
                    <button onClick={()=>removeEntry(i)} className="col-span-1 text-brand-inkSoft hover:text-brand-danger" data-testid={`del-sched-${i}`}><Trash2 className="w-4 h-4 mx-auto"/></button>
                  </div>
                ))}
                {schedule.entries.length === 0 && <div className="text-center py-8 text-brand-inkSoft text-sm">Sem entradas para este mes. Clique em "Entrada".</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

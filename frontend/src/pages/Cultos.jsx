import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Calendar, Radio, Pencil } from "lucide-react";

export default function Cultos() {
  const [churches, setChurches] = useState([]);
  const [church, setChurch] = useState("");
  const [list, setList] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const defaultDt = () => { const d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours()+2); return d.toISOString().slice(0,16); };
  const [form, setForm] = useState({ name: "", date: defaultDt(), template_id: "" });

  useEffect(() => {
    api.get("/churches").then(r => { setChurches(r.data); if (r.data.length) setChurch(r.data[0].church_id); });
  }, []);
  useEffect(() => {
    if (!church) return;
    api.get(`/churches/${church}/services`).then(r => setList(r.data));
    api.get(`/churches/${church}/templates`).then(r => setTemplates(r.data));
  }, [church]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { name: form.name, date: new Date(form.date).toISOString(), template_id: form.template_id || null };
      await api.post(`/churches/${church}/services`, payload);
      toast.success("Culto criado");
      setForm({ name: "", date: defaultDt(), template_id: "" }); setShowForm(false);
      api.get(`/churches/${church}/services`).then(r => setList(r.data));
    } catch (err) { toast.error("Falha"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir este culto?")) return;
    await api.delete(`/services/${id}`);
    setList(list.filter(s => s.service_id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline mb-2">Agenda</div>
          <h1 className="font-heading text-3xl font-bold text-brand-ink">Cultos</h1>
        </div>
        <div className="flex gap-3">
          <select value={church} onChange={e=>setChurch(e.target.value)} className="px-3 py-2 border border-brand-line rounded-md bg-white" data-testid="services-church-select">
            {churches.map(c => <option key={c.church_id} value={c.church_id}>{c.name}</option>)}
          </select>
          <button onClick={()=>setShowForm(s=>!s)} className="brand-btn-primary flex items-center gap-2" data-testid="new-service-btn" disabled={!church}>
            <Plus className="w-4 h-4"/> Novo culto
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="brand-card p-6 mb-6 grid md:grid-cols-4 gap-4" data-testid="service-form">
          <input required placeholder="Nome do culto" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none md:col-span-2" data-testid="service-name-input"/>
          <input required type="datetime-local" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="service-date-input"/>
          <div className="flex gap-2">
            <select value={form.template_id} onChange={e=>setForm({...form, template_id: e.target.value})} className="flex-1 px-3 py-2.5 border border-brand-line rounded-md focus:outline-none" data-testid="service-template-select">
              <option value="">Sem template</option>
              {templates.map(t => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}
            </select>
            <button className="brand-btn-primary" data-testid="service-save">Salvar</button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map(s => (
          <div key={s.service_id} className="brand-card p-6" data-testid={`service-card-${s.service_id}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-md bg-brand-sage/15 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-brand-sage" />
              </div>
              <button onClick={() => remove(s.service_id)} className="text-brand-inkSoft hover:text-brand-danger" data-testid={`delete-service-${s.service_id}`}><Trash2 className="w-4 h-4"/></button>
            </div>
            <h3 className="font-heading text-xl font-semibold text-brand-ink">{s.name}</h3>
            <p className="text-sm text-brand-inkSoft mt-1">{new Date(s.date).toLocaleString("pt-BR")}</p>
            <div className="overline mt-3">{s.steps?.length || 0} etapas</div>
            <div className="flex gap-2 mt-4">
              <Link to={`/cultos/${s.service_id}/editor`} className="flex-1 brand-btn-ghost flex items-center justify-center gap-2 text-sm" data-testid={`edit-${s.service_id}`}>
                <Pencil className="w-3 h-3"/> Liturgia
              </Link>
              <Link to={`/cultos/${s.service_id}/live`} className="flex-1 brand-btn-secondary flex items-center justify-center gap-2 text-sm" data-testid={`live-${s.service_id}`}>
                <Radio className="w-3 h-3"/> Ao vivo
              </Link>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full text-center py-12 text-brand-inkSoft">Nenhum culto agendado.</div>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Building2, Plus, Trash2 } from "lucide-react";

export default function Igrejas() {
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", timezone: "America/Sao_Paulo" });

  const load = () => api.get("/churches").then(r => setList(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/churches", form);
      toast.success("Igreja criada");
      setForm({ name: "", city: "", timezone: "America/Sao_Paulo" });
      setShowForm(false);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Falha"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir esta igreja?")) return;
    try { await api.delete(`/churches/${id}`); toast.success("Removida"); load(); }
    catch (e) { toast.error("Falha ao remover"); }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline mb-2">Multi-igrejas</div>
          <h1 className="font-heading text-3xl font-bold text-brand-ink">Igrejas</h1>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="brand-btn-primary flex items-center gap-2" data-testid="new-church-btn">
          <Plus className="w-4 h-4" /> Nova igreja
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="brand-card p-6 mb-6 grid md:grid-cols-3 gap-4" data-testid="church-form">
          <input required placeholder="Nome" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="church-name-input"/>
          <input placeholder="Cidade" value={form.city} onChange={e=>setForm({...form, city: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="church-city-input"/>
          <div className="flex gap-2">
            <input placeholder="Timezone" value={form.timezone} onChange={e=>setForm({...form, timezone: e.target.value})} className="flex-1 px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="church-tz-input"/>
            <button className="brand-btn-primary" data-testid="church-save">Salvar</button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map(c => (
          <div key={c.church_id} className="brand-card p-6" data-testid={`church-${c.church_id}`}>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-md bg-brand-terracotta/10 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5 text-brand-terracotta" />
              </div>
              <button onClick={() => remove(c.church_id)} className="text-brand-inkSoft hover:text-brand-danger" data-testid={`delete-church-${c.church_id}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h3 className="font-heading text-xl font-semibold text-brand-ink">{c.name}</h3>
            <p className="text-sm text-brand-inkSoft mt-1">{c.city || "—"}</p>
            <div className="overline mt-3">{c.timezone}</div>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-full text-center py-12 text-brand-inkSoft">Nenhuma igreja ainda.</div>}
      </div>
    </div>
  );
}

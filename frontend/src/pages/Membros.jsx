import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, User } from "lucide-react";

export default function Membros() {
  const [churches, setChurches] = useState([]);
  const [church, setChurch] = useState("");
  const [list, setList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", roles: "" });

  useEffect(() => {
    api.get("/churches").then(r => {
      setChurches(r.data);
      if (r.data.length && !church) setChurch(r.data[0].church_id);
    });
  }, []);
  useEffect(() => {
    if (!church) return;
    api.get(`/churches/${church}/members`).then(r => setList(r.data)).catch(()=>{});
  }, [church]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name, email: form.email || null, phone: form.phone,
        roles: form.roles.split(",").map(s=>s.trim()).filter(Boolean),
      };
      await api.post(`/churches/${church}/members`, payload);
      toast.success("Membro adicionado");
      setForm({ name: "", email: "", phone: "", roles: "" });
      setShowForm(false);
      api.get(`/churches/${church}/members`).then(r => setList(r.data));
    } catch (e) { toast.error(e?.response?.data?.detail || "Falha"); }
  };

  const remove = async (id) => {
    if (!window.confirm("Excluir membro?")) return;
    await api.delete(`/members/${id}`);
    setList(list.filter(m => m.member_id !== id));
    toast.success("Removido");
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline mb-2">Comunidade</div>
          <h1 className="font-heading text-3xl font-bold text-brand-ink">Membros</h1>
        </div>
        <div className="flex gap-3">
          <select value={church} onChange={e=>setChurch(e.target.value)} className="px-3 py-2 border border-brand-line rounded-md bg-white" data-testid="members-church-select">
            {churches.map(c => <option key={c.church_id} value={c.church_id}>{c.name}</option>)}
          </select>
          <button onClick={()=>setShowForm(s=>!s)} className="brand-btn-primary flex items-center gap-2" data-testid="new-member-btn" disabled={!church}>
            <Plus className="w-4 h-4"/> Novo membro
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="brand-card p-6 mb-6 grid md:grid-cols-4 gap-4" data-testid="member-form">
          <input required placeholder="Nome" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="member-name-input"/>
          <input type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="member-email-input"/>
          <input placeholder="Telefone" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="member-phone-input"/>
          <div className="flex gap-2">
            <input placeholder="Cargos (virgula)" value={form.roles} onChange={e=>setForm({...form, roles: e.target.value})} className="flex-1 px-3 py-2.5 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid="member-roles-input"/>
            <button className="brand-btn-primary" data-testid="member-save">Salvar</button>
          </div>
        </form>
      )}

      <div className="brand-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-bg border-b border-brand-line">
            <tr className="text-left text-xs uppercase tracking-wider text-brand-inkSoft">
              <th className="px-6 py-4">Membro</th><th className="px-6 py-4">Cargos</th><th className="px-6 py-4 hidden md:table-cell">Contato</th><th className="px-6 py-4 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(m => (
              <tr key={m.member_id} className="border-b border-brand-line hover:bg-brand-bg/60" data-testid={`member-row-${m.member_id}`}>
                <td className="px-6 py-4"><div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-sage/20 flex items-center justify-center text-brand-sage"><User className="w-4 h-4"/></div>
                  <div className="font-medium">{m.name}</div>
                </div></td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {(m.roles || []).map(r => <span key={r} className="text-[11px] px-2 py-0.5 bg-brand-sand/40 text-brand-ink rounded">{r}</span>)}
                    {(!m.roles || !m.roles.length) && <span className="text-xs text-brand-inkSoft">—</span>}
                  </div>
                </td>
                <td className="px-6 py-4 hidden md:table-cell text-sm text-brand-inkSoft">{m.email || m.phone || "—"}</td>
                <td className="px-6 py-4"><button onClick={()=>remove(m.member_id)} className="text-brand-inkSoft hover:text-brand-danger" data-testid={`delete-member-${m.member_id}`}><Trash2 className="w-4 h-4"/></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="text-center py-12 text-brand-inkSoft">Nenhum membro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import api, { API } from "@/lib/api";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { Download } from "lucide-react";

export default function Relatorios() {
  const [churches, setChurches] = useState([]);
  const [church, setChurch] = useState("");
  const [rep, setRep] = useState(null);

  useEffect(() => { api.get("/churches").then(r => { setChurches(r.data); if (r.data.length) setChurch(r.data[0].church_id); }); }, []);
  useEffect(() => { if (church) api.get(`/churches/${church}/reports`).then(r => setRep(r.data)); }, [church]);

  const download = () => {
    const token = localStorage.getItem("cf_token");
    // Use fetch with auth + blob
    fetch(`${API}/churches/${church}/reports/export`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob()).then(b => {
        const u = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = u; a.download = `relatorio_${church}.csv`; a.click();
        URL.revokeObjectURL(u);
      });
  };

  const memberData = (rep?.member_stats || []).slice(0, 8).map(m => ({ name: m.name.split(" ")[0], qtd: m.assignments }));
  const roleData = Object.entries(rep?.role_counts || {}).map(([k, v]) => ({ name: k, qtd: v }));
  const palette = ["#E07A5F","#81B29A","#F2CC8F","#D95D39","#5C6B61"];

  return (
    <div className="max-w-7xl mx-auto animate-fade-up">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div><div className="overline mb-2">Insights</div><h1 className="font-heading text-3xl font-bold text-brand-ink">Relatorios</h1></div>
        <div className="flex gap-3">
          <select value={church} onChange={e=>setChurch(e.target.value)} className="px-3 py-2 border border-brand-line rounded-md bg-white" data-testid="rep-church-select">
            {churches.map(c => <option key={c.church_id} value={c.church_id}>{c.name}</option>)}
          </select>
          <button onClick={download} className="brand-btn-ghost flex items-center gap-2" data-testid="export-csv-btn"><Download className="w-4 h-4"/> CSV</button>
        </div>
      </div>

      {rep ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="brand-card p-5"><div className="overline mb-2">Membros</div><div className="text-3xl font-heading font-bold text-brand-ink" data-testid="rep-total-members">{rep.total_members}</div></div>
            <div className="brand-card p-5"><div className="overline mb-2">Cultos</div><div className="text-3xl font-heading font-bold text-brand-ink" data-testid="rep-total-services">{rep.total_services}</div></div>
            <div className="brand-card p-5"><div className="overline mb-2">Atribuicoes</div><div className="text-3xl font-heading font-bold text-brand-ink" data-testid="rep-total-assignments">{rep.total_assignments}</div></div>
            <div className="brand-card p-5"><div className="overline mb-2">Media/culto</div><div className="text-3xl font-heading font-bold text-brand-ink">{rep.total_services ? (rep.total_assignments/rep.total_services).toFixed(1) : 0}</div></div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <div className="brand-card p-6">
              <h3 className="font-heading text-lg font-semibold text-brand-ink mb-4">Top participantes</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={memberData}>
                  <XAxis dataKey="name" stroke="#5C6B61" fontSize={11}/>
                  <YAxis stroke="#5C6B61" fontSize={11}/>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E3DC", borderRadius: 8 }}/>
                  <Bar dataKey="qtd" radius={[6,6,0,0]}>{memberData.map((_,i)=><Cell key={i} fill={palette[i%palette.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="brand-card p-6">
              <h3 className="font-heading text-lg font-semibold text-brand-ink mb-4">Frequencia por cargo</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={roleData}>
                  <XAxis dataKey="name" stroke="#5C6B61" fontSize={11}/>
                  <YAxis stroke="#5C6B61" fontSize={11}/>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E3DC", borderRadius: 8 }}/>
                  <Bar dataKey="qtd" radius={[6,6,0,0]}>{roleData.map((_,i)=><Cell key={i} fill={palette[(i+1)%palette.length]}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="brand-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-bg border-b border-brand-line"><tr className="text-left text-xs uppercase tracking-wider text-brand-inkSoft"><th className="px-6 py-4">Membro</th><th className="px-6 py-4">Cargos</th><th className="px-6 py-4">Participacoes</th></tr></thead>
              <tbody>
                {rep.member_stats.map(m => (
                  <tr key={m.member_id} className="border-b border-brand-line"><td className="px-6 py-3 font-medium">{m.name}</td><td className="px-6 py-3 text-sm text-brand-inkSoft">{m.roles.join(", ") || "—"}</td><td className="px-6 py-3">{m.assignments}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <div className="text-brand-inkSoft">Carregando relatorio...</div>}
    </div>
  );
}

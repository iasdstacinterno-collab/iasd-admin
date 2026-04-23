import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import api from "@/lib/api";
import { toast } from "sonner";
import { GripVertical, Plus, Trash2, ArrowLeft, Sparkles, Save, Radio } from "lucide-react";

function StepRow({ step, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={`brand-card p-4 flex items-start gap-3 ${isDragging ? "shadow-xl scale-[1.02]" : ""}`} data-testid={`step-row-${step.id}`}>
      <button {...attributes} {...listeners} className="pt-1 cursor-grab active:cursor-grabbing text-brand-inkSoft hover:text-brand-ink" data-testid={`step-drag-${step.id}`}>
        <GripVertical className="w-5 h-5"/>
      </button>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-3">
        <input placeholder="Nome da etapa" value={step.name} onChange={e=>onChange({ ...step, name: e.target.value })} className="md:col-span-2 px-3 py-2 border border-brand-line rounded-md focus:ring-2 focus:ring-brand-terracotta focus:outline-none" data-testid={`step-name-${step.id}`}/>
        <input type="number" min={1} placeholder="min" value={step.duration_min} onChange={e=>onChange({ ...step, duration_min: Number(e.target.value) })} className="px-3 py-2 border border-brand-line rounded-md focus:outline-none" data-testid={`step-duration-${step.id}`}/>
        <input placeholder="Cargo sugerido" value={step.suggested_role || ""} onChange={e=>onChange({ ...step, suggested_role: e.target.value })} className="md:col-span-2 px-3 py-2 border border-brand-line rounded-md focus:outline-none" data-testid={`step-role-${step.id}`}/>
        <input placeholder="Notas" value={step.notes || ""} onChange={e=>onChange({ ...step, notes: e.target.value })} className="px-3 py-2 border border-brand-line rounded-md focus:outline-none" data-testid={`step-notes-${step.id}`}/>
      </div>
      <button onClick={onRemove} className="pt-1 text-brand-inkSoft hover:text-brand-danger" data-testid={`step-remove-${step.id}`}><Trash2 className="w-4 h-4"/></button>
    </div>
  );
}

export default function ServiceEditor() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [steps, setSteps] = useState([]);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = async () => {
    const s = await api.get(`/services/${id}`).then(r => r.data);
    setService(s);
    setSteps(s.steps || []);
    const [mb, asg] = await Promise.all([
      api.get(`/churches/${s.church_id}/members`).then(r => r.data),
      api.get(`/services/${id}/assignments`).then(r => r.data),
    ]);
    setMembers(mb); setAssignments(asg);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = steps.findIndex(s => s.id === active.id);
    const newIdx = steps.findIndex(s => s.id === over.id);
    setSteps(arrayMove(steps, oldIdx, newIdx));
  };

  const addStep = () => {
    const newId = "tmp_" + Math.random().toString(36).slice(2,10);
    setSteps([...steps, { id: newId, name: "Nova etapa", duration_min: 5, notes: "", suggested_role: "" }]);
  };

  const saveSteps = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/services/${id}/steps`, steps.map(({id, name, duration_min, notes, suggested_role}) => ({id, name, duration_min, notes, suggested_role})));
      setSteps(res.data.steps); toast.success("Liturgia salva");
    } catch { toast.error("Falha ao salvar"); }
    setSaving(false);
  };

  const suggest = async () => {
    try {
      const { data } = await api.post(`/services/${id}/suggest`);
      // Create assignments for each suggestion
      for (const s of data.suggestions) {
        // skip if already exists
        if (assignments.find(a => a.step_id === s.step_id)) continue;
        await api.post(`/services/${id}/assignments`, { step_id: s.step_id, member_id: s.member_id });
      }
      toast.success(`${data.suggestions.length} atribuicoes sugeridas`);
      load();
    } catch { toast.error("Falha na sugestao"); }
  };

  const assign = async (step_id, member_id) => {
    if (!member_id) return;
    await api.post(`/services/${id}/assignments`, { step_id, member_id });
    load();
  };
  const removeAsg = async (aid) => { await api.delete(`/assignments/${aid}`); load(); };

  if (!service) return <div className="text-brand-inkSoft">Carregando...</div>;
  const memberMap = Object.fromEntries(members.map(m => [m.member_id, m]));
  const asgByStep = {};
  assignments.forEach(a => { (asgByStep[a.step_id] = asgByStep[a.step_id] || []).push(a); });

  return (
    <div className="max-w-6xl mx-auto animate-fade-up">
      <Link to="/cultos" className="text-sm text-brand-inkSoft hover:text-brand-ink flex items-center gap-1 mb-4" data-testid="editor-back">
        <ArrowLeft className="w-4 h-4"/> Voltar
      </Link>
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="overline mb-2">Editor de liturgia</div>
          <h1 className="font-heading text-3xl font-bold text-brand-ink">{service.name}</h1>
          <p className="text-brand-inkSoft mt-1">{new Date(service.date).toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={suggest} className="brand-btn-ghost flex items-center gap-2" data-testid="suggest-btn"><Sparkles className="w-4 h-4"/> Sugerir escala</button>
          <button onClick={saveSteps} disabled={saving} className="brand-btn-primary flex items-center gap-2" data-testid="save-liturgy-btn"><Save className="w-4 h-4"/> {saving ? "Salvando..." : "Salvar"}</button>
          <Link to={`/cultos/${id}/live`} className="brand-btn-secondary flex items-center gap-2" data-testid="go-live-btn"><Radio className="w-4 h-4"/> Ao vivo</Link>
        </div>
      </div>

      <div className="space-y-3 mb-4" data-testid="steps-list">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {steps.map((s, i) => (
              <div key={s.id} className="relative">
                <div className="absolute -left-10 top-6 hidden lg:flex w-7 h-7 rounded-full bg-brand-terracotta text-white items-center justify-center text-xs font-bold">{i+1}</div>
                <StepRow step={s} onChange={(nv)=>setSteps(steps.map(x => x.id===s.id ? nv : x))} onRemove={()=>setSteps(steps.filter(x=>x.id!==s.id))}/>
                {/* Assignments per step */}
                <div className="ml-10 mt-2 flex flex-wrap gap-2 items-center">
                  {(asgByStep[s.id] || []).map(a => (
                    <span key={a.assignment_id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-sage/15 text-brand-sage text-xs" data-testid={`asg-${a.assignment_id}`}>
                      {memberMap[a.member_id]?.name || "?"} · <span className="capitalize">{a.status}</span>
                      <button onClick={()=>removeAsg(a.assignment_id)} className="hover:text-brand-danger">×</button>
                    </span>
                  ))}
                  <select onChange={(e)=>{ assign(s.id, e.target.value); e.target.value=""; }} className="text-xs border border-brand-line rounded px-2 py-1 bg-white" data-testid={`assign-select-${s.id}`}>
                    <option value="">+ Atribuir membro</option>
                    {members.map(m => <option key={m.member_id} value={m.member_id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <button onClick={addStep} className="w-full py-3 border-2 border-dashed border-brand-sage rounded-md text-brand-sage hover:bg-brand-sage/5 flex items-center justify-center gap-2" data-testid="add-step-btn">
        <Plus className="w-4 h-4"/> Adicionar etapa
      </button>
    </div>
  );
}

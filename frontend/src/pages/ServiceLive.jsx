import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { ArrowLeft, Play, Pause, SkipForward, RotateCcw } from "lucide-react";

export default function ServiceLive() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [current, setCurrent] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds in current step

  useEffect(() => {
    api.get(`/services/${id}`).then(r => setService(r.data));
  }, [id]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const steps = service?.steps || [];
  const step = steps[current];
  const totalDur = useMemo(() => (step?.duration_min || 0) * 60, [step]);
  const progress = totalDur ? Math.min(100, (elapsed / totalDur) * 100) : 0;
  const mm = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const next = () => { if (current < steps.length - 1) { setCurrent(current+1); setElapsed(0); } };
  const reset = () => { setElapsed(0); };

  if (!service) return <div className="min-h-screen bg-brand-ink text-white flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-brand-ink text-white" data-testid="live-root">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          <Link to={`/cultos/${id}/editor`} className="text-sm text-white/60 hover:text-white flex items-center gap-2" data-testid="live-back">
            <ArrowLeft className="w-4 h-4"/> Voltar ao editor
          </Link>
          <div className="text-sm text-white/60 uppercase tracking-[0.3em]">Modo Culto ao Vivo</div>
        </div>

        <div className="mb-10">
          <div className="text-white/40 text-sm uppercase tracking-widest mb-2">Etapa atual · {current+1} de {steps.length}</div>
          <h1 className="font-heading text-5xl md:text-7xl font-bold leading-none" data-testid="live-current-name">{step?.name || "—"}</h1>
          {step?.notes && <p className="text-xl text-white/70 mt-4 max-w-3xl">{step.notes}</p>}
          {step?.suggested_role && <div className="mt-4 inline-block px-4 py-2 bg-brand-sage text-brand-ink rounded-md font-medium">Responsavel sugerido: {step.suggested_role}</div>}
        </div>

        <div className="bg-white/5 rounded-xl p-8 mb-10 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="text-6xl md:text-8xl font-heading font-bold tabular-nums" data-testid="live-timer">{mm(elapsed)}</div>
            <div className="text-white/60 text-lg">/ {mm(totalDur)}</div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand-sage transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={()=>setRunning(!running)} className="flex items-center gap-2 px-6 py-3 bg-brand-terracotta hover:bg-brand-terracottaHover text-white rounded-md font-medium transition-colors" data-testid="live-play">
              {running ? <><Pause className="w-4 h-4"/> Pausar</> : <><Play className="w-4 h-4"/> Iniciar</>}
            </button>
            <button onClick={reset} className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-md" data-testid="live-reset"><RotateCcw className="w-4 h-4"/> Reset</button>
            <button onClick={next} disabled={current>=steps.length-1} className="flex items-center gap-2 px-6 py-3 bg-brand-sage hover:bg-brand-sageHover text-white rounded-md font-medium disabled:opacity-40" data-testid="live-next"><SkipForward className="w-4 h-4"/> Proxima etapa</button>
          </div>
        </div>

        <div>
          <div className="text-white/50 text-sm uppercase tracking-widest mb-4">Proximas etapas</div>
          <div className="space-y-2">
            {steps.slice(current+1, current+5).map((s, i) => (
              <div key={s.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-md border border-white/10" data-testid={`live-next-${s.id}`}>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">{current+2+i}</div>
                <div className="flex-1"><div className="font-medium">{s.name}</div></div>
                <div className="text-white/50 text-sm">{s.duration_min} min</div>
              </div>
            ))}
            {current >= steps.length - 1 && <div className="text-white/40 italic">Ultima etapa.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

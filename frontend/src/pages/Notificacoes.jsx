import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Bell } from "lucide-react";

export default function Notificacoes() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/notifications").then(r => setList(r.data)); }, []);
  return (
    <div className="max-w-4xl mx-auto animate-fade-up">
      <div className="mb-8"><div className="overline mb-2">Central</div><h1 className="font-heading text-3xl font-bold text-brand-ink">Notificacoes</h1></div>
      <div className="space-y-3">
        {list.map(n => (
          <div key={n.notification_id} className="brand-card p-5 flex items-start gap-4" data-testid={`notif-${n.notification_id}`}>
            <div className="w-10 h-10 rounded-md bg-brand-terracotta/10 flex items-center justify-center"><Bell className="w-5 h-5 text-brand-terracotta"/></div>
            <div className="flex-1">
              <div className="font-medium text-brand-ink">{n.title}</div>
              <div className="text-sm text-brand-inkSoft">{n.body}</div>
              <div className="text-xs text-brand-inkSoft mt-2">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="text-center py-12 text-brand-inkSoft">Sem notificacoes.</div>}
      </div>
    </div>
  );
}

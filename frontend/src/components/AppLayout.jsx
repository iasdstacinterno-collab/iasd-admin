import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  LayoutDashboard, Building2, Users, CalendarDays, ClipboardList,
  Vote, FileBarChart, Bell, LogOut, Menu, X, Church as ChurchIcon,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Visao Geral", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/igrejas", label: "Igrejas", icon: Building2, testid: "nav-igrejas", roles: ["ADMIN_GLOBAL"] },
  { to: "/membros", label: "Membros", icon: Users, testid: "nav-membros" },
  { to: "/cultos", label: "Cultos", icon: CalendarDays, testid: "nav-cultos" },
  { to: "/escalas", label: "Escalas", icon: ClipboardList, testid: "nav-escalas" },
  { to: "/eleicoes", label: "Eleicoes", icon: Vote, testid: "nav-eleicoes" },
  { to: "/relatorios", label: "Relatorios", icon: FileBarChart, testid: "nav-relatorios" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    api.get("/notifications").then(r => setNotifCount((r.data || []).filter(n => !n.read).length)).catch(() => {});
  }, [loc.pathname]);

  const items = NAV.filter(n => !n.roles || n.roles.includes(user?.role) || user?.role === "ADMIN_GLOBAL");

  const doLogout = async () => { await logout(); nav("/"); };

  return (
    <div className="min-h-screen bg-brand-bg flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-brand-line transform transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-20 px-6 flex items-center justify-between border-b border-brand-line">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="sidebar-logo">
            <div className="w-9 h-9 rounded-md bg-brand-terracotta flex items-center justify-center">
              <ChurchIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-heading font-bold text-brand-ink text-lg leading-none">ChurchFlow</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-brand-sage mt-1">Gestao de Igrejas</div>
            </div>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)} data-testid="sidebar-close"><X className="w-5 h-5" /></button>
        </div>
        <nav className="p-4 space-y-1">
          {items.map(n => {
            const Icon = n.icon;
            const active = loc.pathname === n.to || (n.to !== "/dashboard" && loc.pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} data-testid={n.testid}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${active ? "bg-brand-bg text-brand-terracotta font-semibold" : "text-brand-inkSoft hover:bg-brand-bg hover:text-brand-ink"}`}>
                <Icon className="w-4 h-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-brand-line bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-brand-sage text-white flex items-center justify-center font-bold">
              {(user?.name || "U").substring(0,1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-brand-ink truncate" data-testid="user-name">{user?.name}</div>
              <div className="text-xs text-brand-inkSoft truncate">{user?.role?.replace("_", " ")}</div>
            </div>
          </div>
          <button onClick={doLogout} className="brand-btn-ghost w-full flex items-center justify-center gap-2" data-testid="logout-btn">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="h-20 px-6 lg:px-10 flex items-center justify-between glass-header sticky top-0 z-30">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="sidebar-open"><Menu className="w-5 h-5" /></button>
          <div className="flex items-center gap-4 ml-auto">
            <Link to="/notificacoes" className="relative" data-testid="notif-bell">
              <Bell className="w-5 h-5 text-brand-ink" />
              {notifCount > 0 && <span className="absolute -top-1 -right-1 bg-brand-terracotta text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{notifCount}</span>}
            </Link>
            <Link to="/app" className="text-sm text-brand-inkSoft hover:text-brand-ink" data-testid="mobile-link">Area Participante</Link>
          </div>
        </header>
        <div className="p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
      {open && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}
    </div>
  );
}

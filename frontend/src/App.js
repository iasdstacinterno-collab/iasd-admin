import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import AuthCallback from "@/pages/AuthCallback";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Igrejas from "@/pages/Igrejas";
import Membros from "@/pages/Membros";
import Cultos from "@/pages/Cultos";
import ServiceEditor from "@/pages/ServiceEditor";
import ServiceLive from "@/pages/ServiceLive";
import Escalas from "@/pages/Escalas";
import Eleicoes from "@/pages/Eleicoes";
import Relatorios from "@/pages/Relatorios";
import Notificacoes from "@/pages/Notificacoes";
import ParticipantApp from "@/pages/ParticipantApp";

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/cultos/:id/live" element={<ProtectedRoute><ServiceLive /></ProtectedRoute>} />
      <Route path="/app" element={<ProtectedRoute><ParticipantApp /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/igrejas" element={<Igrejas />} />
        <Route path="/membros" element={<Membros />} />
        <Route path="/cultos" element={<Cultos />} />
        <Route path="/cultos/:id/editor" element={<ServiceEditor />} />
        <Route path="/escalas" element={<Escalas />} />
        <Route path="/eleicoes" element={<Eleicoes />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;

import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg" data-testid="protected-loading">
        <div className="animate-pulse text-brand-inkSoft">Carregando...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

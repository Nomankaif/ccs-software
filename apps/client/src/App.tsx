import { Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./components/Login";
import { CaseLibrary } from "./components/CaseLibrary";
import { Simulator } from "./components/Simulator";
import { AdminPortal } from "./components/AdminPortal";
import { useSession } from "./hooks";

export function App() {
  const userQuery = useSession();
  if (userQuery.isLoading) return <div className="grid min-h-screen place-items-center bg-clinical-bg text-sm text-slate-600">Loading ClinSim...</div>;
  const user = userQuery.data?.user;
  const homePath = user?.role === "admin" ? "/admin" : "/cases";
  return <Routes>
    <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <Login />} />
    <Route
      path="/cases"
      element={user?.role === "student" ? <CaseLibrary /> : <Navigate to={user ? homePath : "/login"} replace />}
    />
    <Route
      path="/attempts/:attemptId"
      element={user?.role === "student" ? <Simulator /> : <Navigate to={user ? homePath : "/login"} replace />}
    />
    <Route
      path="/admin"
      element={user?.role === "admin" ? <AdminPortal /> : <Navigate to={user ? homePath : "/login"} replace />}
    />
    <Route path="*" element={<Navigate to={user ? homePath : "/login"} replace />} />
  </Routes>;
}

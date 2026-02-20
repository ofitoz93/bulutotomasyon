import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import Login from "@/pages/auth/Login";
import UpdatePassword from "@/pages/auth/UpdatePassword";
import CompaniesPage from "@/pages/admin/CompaniesPage";
import ModulesPage from "@/pages/admin/ModulesPage";
import TeamPage from "@/pages/manager/TeamPage";
import DocumentTrackingPage from "@/pages/modules/DocumentTrackingPage";
import EquipmentTrackingPage from "@/pages/modules/EquipmentTrackingPage";
import QRScanPage from "@/pages/QRScanPage";
import ADRDashboard from "@/pages/adr/ADRDashboard";
import NewADRForm from "@/pages/adr/NewADRForm";
import ADRDetail from "@/pages/adr/ADRDetail";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase";

function App() {
  const setSession = useAuthStore((state) => state.setSession);
  const loading = useAuthStore((state) => state.loading);
  const setProfile = useAuthStore((state) => state.setProfile);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
          setProfile(data);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
          setProfile(data);
        });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setProfile]);

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth/login" replace />} />

        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="update-password" element={<UpdatePassword />} />
        </Route>

        <Route path="/app" element={<DashboardLayout />}>
          <Route index element={<div className="text-gray-600">Panele Hoşgeldiniz! Modül seçmek için menüyü kullanın.</div>} />
          <Route path="evrak-takip" element={<DocumentTrackingPage />} />
          <Route path="ekipman-takip" element={<EquipmentTrackingPage />} />
          <Route path="adr">
            <Route index element={<ADRDashboard />} />
            <Route path="new" element={<NewADRForm />} />
            <Route path=":id" element={<ADRDetail />} />
          </Route>
        </Route>

        <Route path="/qr/:token" element={<QRScanPage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<DashboardLayout />}>
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route index element={<Navigate to="/admin/companies" replace />} />
        </Route>

        {/* Manager Routes */}
        <Route path="/manager" element={<DashboardLayout />}>
          <Route path="team" element={<TeamPage />} />
          <Route index element={<Navigate to="/manager/team" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

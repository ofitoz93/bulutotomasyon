import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import Login from "@/pages/auth/Login";
import UpdatePassword from "@/pages/auth/UpdatePassword";
import CompaniesPage from "@/pages/admin/CompaniesPage";
import ModulesPage from "@/pages/admin/ModulesPage";
import SystemAnnouncementsPage from "@/pages/admin/AnnouncementsPage";
import TeamPage from "@/pages/manager/TeamPage";
import ManagerAnnouncementsPage from "@/pages/manager/ManagerAnnouncementsPage";
import DocumentTrackingPage from "@/pages/modules/DocumentTrackingPage";
import EquipmentTrackingPage from "@/pages/modules/EquipmentTrackingPage";
import QRScanPage from "@/pages/QRScanPage";
import Dashboard from "@/pages/Dashboard";
import ADRDashboard from "@/pages/adr/ADRDashboard";
import NewADRForm from "@/pages/adr/NewADRForm";
import ADRDetail from "@/pages/adr/ADRDetail";
import OrganizationChartPage from "@/pages/modules/OrganizationChartPage";
import WorkPermitsLayout from "@/pages/work-permits/WorkPermitsLayout";
import WorkPermitsList from "@/pages/work-permits/WorkPermitsList";
import NewWorkPermit from "@/pages/work-permits/NewWorkPermit";
import WorkPermitDetail from "@/pages/work-permits/WorkPermitDetail";
import WorkPermitSettings from "@/pages/work-permits/WorkPermitSettings";
import QuickPermitApprove from "@/pages/auth/QuickPermitApprove";
import PublicWorkPermitForm from "@/pages/auth/PublicWorkPermitForm";
// Action Tracking
import ActionLayout from "@/pages/actions/ActionLayout";
import ActionDashboard from "@/pages/actions/ActionDashboard";
import ClosedActions from "@/pages/actions/ClosedActions";
import ActionSettings from "@/pages/actions/ActionSettings";
import NewAction from "@/pages/actions/NewAction";
import ActionDetail from "@/pages/actions/ActionDetail";
import SettingsPage from "@/pages/settings/SettingsPage";
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
          <Route path="quick-permit-approve" element={<QuickPermitApprove />} />
          <Route path="public-work-permit" element={<PublicWorkPermitForm />} />
        </Route>

        <Route path="/app" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="evrak-takip" element={<DocumentTrackingPage />} />
          <Route path="ekipman-takip" element={<EquipmentTrackingPage />} />
          <Route path="org-chart" element={<OrganizationChartPage />} />
          <Route path="adr">
            <Route index element={<ADRDashboard />} />
            <Route path="new" element={<NewADRForm />} />
            <Route path=":id" element={<ADRDetail />} />
          </Route>

          <Route path="work-permits" element={<WorkPermitsLayout />}>
            <Route index element={<WorkPermitsList />} />
            <Route path="new" element={<NewWorkPermit />} />
            <Route path="settings" element={<WorkPermitSettings />} />
            <Route path=":id" element={<WorkPermitDetail />} />
          </Route>

          <Route path="aksiyon-takip" element={<ActionLayout />}>
            <Route index element={<ActionDashboard />} />
            <Route path="closed" element={<ClosedActions />} />
            <Route path="settings" element={<ActionSettings />} />
            <Route path="new" element={<NewAction />} />
            <Route path=":id" element={<ActionDetail />} />
          </Route>

          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="/qr/:token" element={<QRScanPage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<DashboardLayout />}>
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="announcements" element={<SystemAnnouncementsPage />} />
          <Route index element={<Navigate to="/admin/companies" replace />} />
        </Route>

        {/* Manager Routes */}
        <Route path="/manager" element={<DashboardLayout />}>
          <Route path="team" element={<TeamPage />} />
          <Route path="announcements" element={<ManagerAnnouncementsPage />} />
          <Route index element={<Navigate to="/manager/team" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

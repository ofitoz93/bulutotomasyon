import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import DashboardLayout from "@/layouts/DashboardLayout";
import Login from "@/pages/auth/Login";
import UpdatePassword from "@/pages/auth/UpdatePassword";
import CompaniesPage from "@/pages/admin/CompaniesPage";
import ModulesPage from "@/pages/admin/ModulesPage";
import SystemAnnouncementsPage from "@/pages/admin/AnnouncementsPage";
import LegalRequirementsPage from "@/pages/admin/LegalRequirementsPage";
import TeamPage from "@/pages/manager/TeamPage";
import SubcontractorsPage from "@/pages/manager/SubcontractorsPage";
import ManagerAnnouncementsPage from "@/pages/manager/ManagerAnnouncementsPage";
import DocumentTrackingPage from "@/pages/modules/DocumentTrackingPage";
import EquipmentTrackingPage from "@/pages/modules/EquipmentTrackingPage";
import QRScanPage from "@/pages/QRScanPage";
import Dashboard from "@/pages/Dashboard";
import WaterManagementPage from "@/pages/modules/WaterManagementPage";
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
import PublicADREntryForm from "@/pages/auth/PublicADREntryForm";
// Action Tracking
import ActionLayout from "@/pages/actions/ActionLayout";
import ActionDashboard from "@/pages/actions/ActionDashboard";
import ClosedActions from "@/pages/actions/ClosedActions";
import ActionSettings from "@/pages/actions/ActionSettings";
import NewAction from "@/pages/actions/NewAction";
import ActionDetail from "@/pages/actions/ActionDetail";
import SettingsPage from "@/pages/settings/SettingsPage";
import EducationLayout from "@/pages/education/EducationLayout";
import ActiveCourses from "@/pages/education/ActiveCourses";
import EducationSettings from "@/pages/education/EducationSettings";
import CourseManagement from "@/pages/education/CourseManagement";
import NewCourseForm from "@/pages/education/NewCourseForm";
import CourseDetail from "@/pages/education/CourseDetail";
import CoursePlayer from "@/pages/education/CoursePlayer";
import CourseExamPlayer from "@/pages/education/CourseExamPlayer";
import PublicExamPage from "@/pages/education/PublicExamPage";
import PhysicalExams from "@/pages/education/PhysicalExams";
import PublicClassSign from "@/pages/education/PublicClassSign";
import ISGCenterLayout from "@/pages/isg-merkezi/ISGCenterLayout";
import ISGDashboard from "@/pages/isg-merkezi/ISGDashboard";
import AccidentTracking from "@/pages/isg-merkezi/AccidentTracking";
import RootCauseAnalysis from "@/pages/isg-merkezi/RootCauseAnalysis";
import AuditTracking from "@/pages/isg-merkezi/AuditTracking";
import RiskAssessments from "@/pages/isg-merkezi/RiskAssessments";
import CorrectiveActions from "@/pages/isg-merkezi/CorrectiveActions";
import MeasurementRecords from "@/pages/isg-merkezi/MeasurementRecords";
import PKDLayout from "@/pages/pkd/PKDLayout";
import PKDDashboard from "@/pages/pkd/PKDDashboard";
import NewPKDForm from "@/pages/pkd/NewPKDForm";
import PersonnelLayout from "@/pages/personnel/PersonnelLayout";
import PersonnelList from "@/pages/personnel/PersonnelList";
import PersonnelDetail from "@/pages/personnel/PersonnelDetail";
import HealthRecords from "@/pages/personnel/HealthRecords";
import PPETracking from "@/pages/personnel/PPETracking";
import BulkOperations from "@/pages/personnel/BulkOperations";
import TMGDAdminPage from "@/pages/tmgd/TMGDAdminPage";
import TMGDPublicPortal from "@/pages/tmgd/TMGDPublicPortal";
import PDFRegulationPage from "@/pages/admin/PDFRegulationPage";
import PDFRegulationView from "@/pages/personnel/PDFRegulationView";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { supabase } from "@/lib/supabase";

function App() {
  const setSession = useAuthStore((state) => state.setSession);
  const loading = useAuthStore((state) => state.loading);
  const setProfile = useAuthStore((state) => state.setProfile);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    // Uygulama genelinde temayı uygula
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      const currentSession = useAuthStore.getState().session;

      // Sekme uykudan uyanınca Supabase TOKEN_REFRESHED veya INITIAL_SESSION yapar.
      // Aynı kullanıcı zaten oturum açıksa HIÇBIR ŞEY YAPMA — sayfayı yenileme, bileşenleri sıfırlama.
      // Supabase kütüphanesi tokeni arka planda kendi yönetir, bize haber vermesine gerek yok.
      if (
        session?.user?.id === currentSession?.user?.id &&
        (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')
      ) {
        return; // Tamamen sessiz geç, hiçbir state güncelleme yapma
      }

      // Gerçek giriş/çıkış olaylarında normal akışa devam et
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
          <Route path="public-adr-entry" element={<PublicADREntryForm />} />
        </Route>

        <Route path="/app" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="evrak-takip" element={<DocumentTrackingPage />} />
          <Route path="ekipman-takip" element={<EquipmentTrackingPage />} />
          <Route path="org-chart" element={<OrganizationChartPage />} />
          <Route path="tmgd" element={<TMGDAdminPage />} />
          <Route path="mevzuat-arsivi" element={<PDFRegulationView />} />
          <Route path="su-yonetimi" element={<WaterManagementPage />} />
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

          <Route path="education" element={<EducationLayout />}>
            <Route index element={<ActiveCourses />} />
            <Route path="settings" element={<EducationSettings />} />
            <Route path="physical-exams" element={<PhysicalExams />} />
            <Route path="manage" element={<CourseManagement />} />
            <Route path="manage/new" element={<NewCourseForm />} />
            <Route path="manage/:id" element={<CourseDetail />} />
            <Route path="course/:id" element={<CoursePlayer />} />
            <Route path="course/:id/exam" element={<CourseExamPlayer />} />
          </Route>

          <Route path="pkd_yonetimi" element={<PKDLayout />}>
            <Route index element={<PKDDashboard />} />
            <Route path="new" element={<NewPKDForm />} />
          </Route>

          <Route path="isg-merkezi" element={<ISGCenterLayout />}>
            <Route index element={<ISGDashboard />} />
            <Route path="kazalar" element={<AccidentTracking />} />
            <Route path="kok-neden" element={<RootCauseAnalysis />} />
            <Route path="denetimler" element={<AuditTracking />} />
            <Route path="risk" element={<RiskAssessments />} />
            <Route path="dof" element={<CorrectiveActions />} />
            <Route path="olcumler" element={<MeasurementRecords />} />
          </Route>

          <Route path="personel-takip" element={<PersonnelLayout />}>
            <Route index element={<PersonnelList />} />
            <Route path=":id" element={<PersonnelDetail />} />
            <Route path="saglik" element={<HealthRecords />} />
            <Route path="kkd" element={<PPETracking />} />
            <Route path="toplu-islem" element={<BulkOperations />} />
          </Route>

          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="/qr/:token" element={<QRScanPage />} />
        <Route path="/tmgd/:slug" element={<TMGDPublicPortal />} />
        <Route path="/public/exam/:id" element={<PublicExamPage />} />
        <Route path="/public/class-sign/:courseId" element={<PublicClassSign />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<DashboardLayout />}>
          <Route path="companies" element={<CompaniesPage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="announcements" element={<SystemAnnouncementsPage />} />
          <Route path="legal-requirements" element={<LegalRequirementsPage />} />
          <Route path="smart-legal" element={<PDFRegulationPage />} />
          <Route index element={<Navigate to="/admin/companies" replace />} />
        </Route>

        {/* Manager Routes */}
        <Route path="/manager" element={<DashboardLayout />}>
          <Route path="team" element={<TeamPage />} />
          <Route path="subcontractors" element={<SubcontractorsPage />} />
          <Route path="announcements" element={<ManagerAnnouncementsPage />} />
          <Route index element={<Navigate to="/manager/team" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

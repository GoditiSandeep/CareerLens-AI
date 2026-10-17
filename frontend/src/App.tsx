// Route table + providers.
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import { ErrorBoundary, Loader, ToastProvider } from "./components/ui";
import { Link } from "react-router-dom";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Careers from "./pages/Careers";
import CareerUniverse from "./pages/CareerUniverse";
import WhatIf from "./pages/WhatIf";
import Skills from "./pages/Skills";
import Roadmap from "./pages/Roadmap";
import Jobs from "./pages/Jobs";
import Applications from "./pages/Applications";
import Resumes from "./pages/Resumes";
import Practice from "./pages/Practice";
import Projects from "./pages/Projects";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import InterviewStudio from "./pages/InterviewStudio";
import CareerTwin from "./pages/CareerTwin";
import CareerQuest from "./pages/CareerQuest";
import GrowthPlanner from "./pages/GrowthPlanner";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

// Admin-only route. This is a UX guard only — every /admin/* API call is
// independently authorized by the backend (AdminUser dependency), so a
// student who bypasses this still gets 403 from the server.
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") {
    return (
      <Layout>
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <p className="section-title">Administrator access required</p>
          <p className="muted mt-2 max-w-md">
            This area is restricted to platform administrators. If you believe you
            should have access, contact the platform owner.
          </p>
          <Link to="/dashboard" className="btn-primary mt-4">Back to my dashboard</Link>
        </div>
      </Layout>
    );
  }
  return <Layout>{children}</Layout>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route
              path="/login"
              element={
                <AuthRedirect>
                  <Login />
                </AuthRedirect>
              }
            />
            <Route
              path="/register"
              element={
                <AuthRedirect>
                  <Register />
                </AuthRedirect>
              }
            />
            <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/careers" element={<Protected><Careers /></Protected>} />
            <Route path="/career-universe" element={<Protected><CareerUniverse /></Protected>} />
            <Route path="/what-if" element={<Protected><WhatIf /></Protected>} />
            <Route path="/skills" element={<Protected><Skills /></Protected>} />
            <Route path="/roadmap" element={<Protected><Roadmap /></Protected>} />
            <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
            <Route path="/applications" element={<Protected><Applications /></Protected>} />
            <Route path="/resumes" element={<Protected><Resumes /></Protected>} />
            <Route path="/practice" element={<Protected><Practice /></Protected>} />
            <Route path="/interview-studio" element={<Protected><InterviewStudio /></Protected>} />
            <Route path="/career-twin" element={<Protected><CareerTwin /></Protected>} />
            <Route path="/career-quest" element={<Protected><CareerQuest /></Protected>} />
            <Route path="/growth-planner" element={<Protected><GrowthPlanner /></Protected>} />
            <Route path="/projects" element={<Protected><ErrorBoundary label="Projects page"><Projects /></ErrorBoundary></Protected>} />
            <Route path="/chat" element={<Protected><Chat /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

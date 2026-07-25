import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import ForgotPassword from "./pages/AuthPages/ForgotPassword";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import NotFound from "./pages/OtherPage/NotFound";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import UserView from "./pages/UserView";
import Creators from "./pages/Creators";
import CreatorView from "./pages/CreatorView";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import { GuestRoute, ProtectedRoute } from "./components/auth/RouteGuards";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<UserView />} />
            <Route path="/creators" element={<Creators />} />
            <Route path="/creators/:id" element={<CreatorView />} />
          </Route>
        </Route>

        <Route element={<GuestRoute />}>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        <Route path="/signup" element={<Navigate to="/signin" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

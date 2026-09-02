import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GuestShell } from './components/GuestShell';
import { MatchShell } from './components/MatchShell';
import { CreatorDeck } from './components/CreatorDeck';
import { CreatorProfile } from './components/CreatorProfile';
import { CreatorCallShell } from './components/CreatorCallShell';
import { RequireAuth } from './components/auth/RequireAuth';
import { usePageTracking } from './hooks/usePageTracking';

function AppRoutes() {
  usePageTracking();

  return (
    <Routes>
      <Route path="/" element={<GuestShell />} />
      <Route
        path="/match"
        element={
          <RequireAuth>
            <MatchShell />
          </RequireAuth>
        }
      />
      <Route
        path="/deck"
        element={
          <RequireAuth>
            <CreatorDeck />
          </RequireAuth>
        }
      />
      <Route
        path="/creator/:id"
        element={
          <RequireAuth>
            <CreatorProfile />
          </RequireAuth>
        }
      />
      <Route
        path="/creator-room"
        element={
          <RequireAuth>
            <CreatorCallShell />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;

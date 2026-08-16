import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../../utils/auth';
import { useCreatorFanWaiting } from '../../hooks/useCreatorFanWaiting';

type RequireAuthProps = {
  children: ReactNode;
};

/** Creator deck and profiles are login-only. */
export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  useCreatorFanWaiting();

  if (!getToken()) {
    return <Navigate to="/" replace state={{ authRequired: location.pathname }} />;
  }

  return children;
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordVisit } from '../services/visits';

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}`;
    void recordVisit(path);
  }, [location.pathname, location.search]);
}

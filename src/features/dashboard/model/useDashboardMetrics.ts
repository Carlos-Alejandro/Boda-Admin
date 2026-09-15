import { useEffect, useRef, useState } from 'react';
import { getInvitations } from '../../invitations/api/invitationService';
import { calculateDashboardMetrics, type DashboardMetrics } from './calculateDashboardMetrics';

type DashboardState =
 | { status: 'loading' }
 | { status: 'error' }
 | { status: 'success'; metrics: DashboardMetrics };

export function useDashboardMetrics() {
 const [state, setState] = useState<DashboardState>({ status: 'loading' });
 const [attempt, setAttempt] = useState(0);
 const request = useRef<ReturnType<typeof getInvitations> | null>(null);

 useEffect(() => {
  let subscribed = true;
  // Reuse the request when StrictMode repeats effect setup in development.
  request.current ??= getInvitations();
  void request.current.then(({ items }) => {
   const metrics = calculateDashboardMetrics(items);
   if (subscribed) setState({ status: 'success', metrics });
  }).catch(() => {
   if (subscribed) setState({ status: 'error' });
  });
  return () => { subscribed = false; };
 }, [attempt]);

 const retry = () => {
  if (state.status !== 'error' || request.current === null) return;
  request.current = null;
  setState({ status: 'loading' });
  setAttempt((value) => value + 1);
 };
 return { state, retry };
}

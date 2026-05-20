import { useEffect, useRef } from 'react';
import axios from 'axios';
import { detectEnv } from '../pwa/detectEnv';

const API = process.env.REACT_APP_BACKEND_URL;
const SESSION_KEY = 'ciltarasa_visit_session';

function getSessionId() {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

/**
 * Fire-and-forget analytics ping on mount.
 * Once per session (sessionStorage). Failures are silent.
 */
export default function useTrackVisit() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    try {
      const env = detectEnv();
      axios.post(`${API}/api/analytics/track`, {
        session_id: getSessionId(),
        path: window.location.hash || '/',
        referrer: document.referrer || '',
        user_agent: navigator.userAgent || '',
        screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        is_pwa: env.isStandalone,
      }).catch(() => {});
    } catch { /* noop */ }
  }, []);
}

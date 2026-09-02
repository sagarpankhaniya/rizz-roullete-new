const VISITOR_SESSION_KEY = 'rizz_visitor_session';

export function getOrCreateVisitorSessionId() {
  let id = localStorage.getItem(VISITOR_SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_SESSION_KEY, id);
  }
  return id;
}

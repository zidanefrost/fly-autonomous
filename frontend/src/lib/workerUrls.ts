// Modal gives every web endpoint its own subdomain rather than a shared
// base + path, e.g.:
//   https://<workspace>--<app>-trigger-refresh.modal.run
//   https://<workspace>--<app>-ai-briefing.modal.run
//   https://<workspace>--<app>-ai-briefing-status.modal.run
// VITE_WORKER_BASE_URL should be set to the common prefix with no trailing
// dash and no ".modal.run", e.g. "https://<workspace>--otp-weather-risk".

const BASE = import.meta.env.VITE_WORKER_BASE_URL as string | undefined;

export const WORKER_CONFIGURED = Boolean(BASE);
export const TRIGGER_REFRESH_URL = BASE ? `${BASE}-trigger-refresh.modal.run` : undefined;
export const AI_BRIEFING_URL = BASE ? `${BASE}-ai-briefing.modal.run` : undefined;
export const AI_BRIEFING_STATUS_URL = BASE ? `${BASE}-ai-briefing-status.modal.run` : undefined;

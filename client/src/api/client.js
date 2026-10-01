import axios from 'axios';

export const http = axios.create({ baseURL: '/api', withCredentials: true });

// Public auth endpoints must not trigger the "session expired" flow
const PUBLIC = ['/auth/login', '/auth/me', '/auth/logout'];

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !PUBLIC.some((p) => url.startsWith(p))) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(err);
  }
);

/** Human-readable message from any axios error (works for blob responses too). */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Is it running?';
  return err?.message || fallback;
}

/** Download a file endpoint (e.g. Excel) with the session cookie and save it. */
export async function download(path, params, fallbackName) {
  try {
    const res = await http.get(path, { params, responseType: 'blob' });
    const cd = res.headers['content-disposition'] || '';
    const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // A failed blob request carries the JSON error as a Blob
    if (err.response?.data instanceof Blob) {
      try {
        const body = JSON.parse(await err.response.data.text());
        err.response.data = body;
      } catch { /* keep original */ }
    }
    throw err;
  }
}

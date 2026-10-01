import { useApi } from './useApi';
import { api } from '../api';

/** Loads every customer (name/_id) by walking the paginated endpoint. Used by selectors. */
export function useAllCustomers() {
  return useApi(async () => {
    let page = 1;
    let pages = 1;
    const out = [];
    do {
      // eslint-disable-next-line no-await-in-loop
      const r = await api.customers({ page, limit: 100 });
      out.push(...r.items);
      pages = r.pages;
      page += 1;
    } while (page <= pages);
    return out;
  }, []);
}

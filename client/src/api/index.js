import { http } from './client';

const get = (url, params) => http.get(url, { params }).then((r) => r.data);
const post = (url, body) => http.post(url, body).then((r) => r.data);
const put = (url, body) => http.put(url, body).then((r) => r.data);
const del = (url) => http.delete(url).then((r) => r.data);

export const api = {
  // auth
  login: (body) => post('/auth/login', body),
  logout: () => post('/auth/logout'),
  me: () => get('/auth/me'),

  dashboard: () => get('/dashboard'),

  // customers
  customers: (params) => get('/customers', params),
  customer: (id) => get(`/customers/${id}`),
  createCustomer: (body) => post('/customers', body),
  updateCustomer: (id, body) => put(`/customers/${id}`, body),
  deleteCustomer: (id) => del(`/customers/${id}`),

  // publications & rates
  publications: (params) => get('/publications', params),
  createPublication: (body) => post('/publications', body),
  updatePublication: (id, body) => put(`/publications/${id}`, body),
  addRate: (id, body) => post(`/publications/${id}/rates`, body),

  // subscriptions & adjustments
  createSubscription: (body) => post('/subscriptions', body),
  updateSubscription: (id, body) => put(`/subscriptions/${id}`, body),
  deleteSubscription: (id) => del(`/subscriptions/${id}`),
  adjustments: (params) => get('/adjustments', params),
  createAdjustment: (body) => post('/adjustments', body),
  deleteAdjustment: (id) => del(`/adjustments/${id}`),

  // bills & payments
  bills: (params) => get('/bills', params),
  billView: (params) => get('/bills/view', params),
  generateBill: (body) => post('/bills/generate', body),
  generateAll: (body) => post('/bills/generate-all', body),
  payments: (params) => get('/payments', params),
  recordPayment: (body) => post('/payments', body),

  // reports & activity
  yearly: (params) => get('/reports/yearly', params),
  logins: (params) => get('/activity/logins', params),
  audit: (params) => get('/activity/audit', params),
};

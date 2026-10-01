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

  // bills & payments (payments are allocated oldest-due-month-first unless targetBillId is given)
  bills: (params) => get('/bills', params),
  billView: (params) => get('/bills/view', params),
  generateBill: (body) => post('/bills/generate', body),
  generateAll: (body) => post('/bills/generate-all', body),
  payments: (params) => get('/payments', params),
  paymentsDue: (customer) => get('/payments/due', { customer }),
  recordPayment: (body) => post('/payments', body),

  // reports & activity
  yearly: (params) => get('/reports/yearly', params),
  logins: (params) => get('/activity/logins', params),
  audit: (params) => get('/activity/audit', params),
  search: (q) => get('/search', { q }),

  // ---- Expense module ----
  employees: (params) => get('/employees', params),
  employee: (id) => get(`/employees/${id}`),
  createEmployee: (body) => post('/employees', body),
  updateEmployee: (id, body) => put(`/employees/${id}`, body),
  deleteEmployee: (id) => del(`/employees/${id}`),

  vehicles: (params) => get('/vehicles', params),
  vehicle: (id) => get(`/vehicles/${id}`),
  createVehicle: (body) => post('/vehicles', body),
  updateVehicle: (id, body) => put(`/vehicles/${id}`, body),
  deleteVehicle: (id) => del(`/vehicles/${id}`),

  fuelEntries: (params) => get('/fuel', params),
  createFuelEntry: (body) => post('/fuel', body),
  updateFuelEntry: (id, body) => put(`/fuel/${id}`, body),
  deleteFuelEntry: (id) => del(`/fuel/${id}`),

  repairs: (params) => get('/repairs', params),
  createRepair: (body) => post('/repairs', body),
  updateRepair: (id, body) => put(`/repairs/${id}`, body),
  deleteRepair: (id) => del(`/repairs/${id}`),

  salaryGrid: (params) => get('/salaries/grid', params),
  salaryHistory: (params) => get('/salaries', params),
  paySalary: (body) => post('/salaries', body),
  salarySlip: (id) => get(`/salaries/${id}/slip`),
  deleteSalaryPayment: (id) => del(`/salaries/${id}`),
  advances: (params) => get('/advances', params),
  createAdvance: (body) => post('/advances', body),

  otherExpenses: (params) => get('/other-expenses', params),
  createOtherExpense: (body) => post('/other-expenses', body),
  updateOtherExpense: (id, body) => put(`/other-expenses/${id}`, body),
  deleteOtherExpense: (id) => del(`/other-expenses/${id}`),

  expenseDashboard: (params) => get('/expenses/dashboard', params),
  profitLoss: (params) => get('/expenses/profit-loss', params),
  expenseLedger: (params) => get('/expenses/ledger', params),
  deliverySheet: (params) => get('/delivery-sheet', params),
  backupUrl: () => '/api/backup',
};

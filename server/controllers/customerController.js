import { Customer, Subscription } from '../models/index.js';
import { deleteCustomerCascade, latestBillMap } from '../services/billingService.js';
import { escapeRegex, notFound, paging } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const activeSubFilter = () => ({ $or: [{ endDate: null }, { endDate: { $gte: new Date() } }] });

export async function list(req, res) {
  const { q, filter } = req.query;
  const { page, limit, skip } = paging(req.query, 12, 100);
  const query = {};

  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    query.$or = [{ name: rx }, { address: rx }, { phone: rx }];
  }
  if (filter === 'active') query.active = true;
  if (filter === 'inactive') query.active = false;
  if (filter === 'dues') {
    const latest = await latestBillMap();
    query._id = { $in: [...latest].filter(([, l]) => l.balance > 0).map(([id]) => id) };
  }

  const [total, customers] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query).collation({ locale: 'en' }).sort({ name: 1 }).skip(skip).limit(limit).lean(),
  ]);

  const ids = customers.map((c) => c._id);
  const [subs, latest] = await Promise.all([
    Subscription.find({ customer: { $in: ids }, ...activeSubFilter() }).populate('publication', 'name type').lean(),
    latestBillMap(ids),
  ]);

  const items = customers.map((c) => ({
    ...c,
    subscriptions: subs
      .filter((s) => String(s.customer) === String(c._id) && s.publication)
      .map((s) => ({ id: s._id, name: s.publication.name, type: s.publication.type })),
    due: latest.get(String(c._id))?.balance || 0,
  }));
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function get(req, res) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) throw notFound('Customer not found');
  const [subscriptions, latest] = await Promise.all([
    Subscription.find({ customer: customer._id }).populate('publication', 'name type frequency active').sort({ startDate: -1 }).lean(),
    latestBillMap([customer._id]),
  ]);
  const l = latest.get(String(customer._id));
  res.json({
    ...customer,
    subscriptions: subscriptions.filter((s) => s.publication),
    due: l?.balance || 0,
    latestBill: l ? { id: l.billId, year: l.year, month: l.month } : null,
  });
}

export async function create(req, res) {
  const customer = await Customer.create(req.body);
  await audit(req, 'customer.created', 'Customer', customer._id, `Added customer ${customer.name}`);
  res.status(201).json(customer);
}

export async function update(req, res) {
  const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!customer) throw notFound('Customer not found');
  await audit(req, 'customer.updated', 'Customer', customer._id, `Updated customer ${customer.name}`);
  res.json(customer);
}

export async function remove(req, res) {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw notFound('Customer not found');
  await deleteCustomerCascade(customer._id);
  await audit(req, 'customer.deleted', 'Customer', customer._id, `Deleted customer ${customer.name} and all related records`);
  res.json({ ok: true });
}

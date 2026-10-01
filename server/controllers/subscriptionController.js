import { Customer, Publication, Subscription } from '../models/index.js';
import { badRequest, notFound, parseDate } from '../utils/http.js';
import { audit } from '../utils/audit.js';

function toDoc(body) {
  return {
    ...body,
    startDate: parseDate(body.startDate),
    endDate: body.endDate ? parseDate(body.endDate) : null,
    weekdays: body.mode === 'weekdays' ? [...new Set(body.weekdays)].sort() : [],
    copiesPerMonth: body.mode === 'fixedPerMonth' ? body.copiesPerMonth : 0,
  };
}

export async function list(req, res) {
  const query = {};
  if (req.query.customer) query.customer = req.query.customer;
  const subs = await Subscription.find(query).populate('publication', 'name type frequency active').sort({ startDate: -1 });
  res.json(subs);
}

export async function create(req, res) {
  const [customer, pub] = await Promise.all([Customer.findById(req.body.customer), Publication.findById(req.body.publication)]);
  if (!customer) throw notFound('Customer not found');
  if (!pub) throw notFound('Publication not found');
  if (!pub.active) throw badRequest('This publication is inactive and cannot be subscribed to');
  const sub = await Subscription.create(toDoc(req.body));
  await audit(req, 'subscription.created', 'Subscription', sub._id, `${customer.name} subscribed to ${pub.name}`);
  res.status(201).json(await sub.populate('publication', 'name type frequency active'));
}

export async function update(req, res) {
  const sub = await Subscription.findById(req.params.id);
  if (!sub) throw notFound('Subscription not found');
  const { customer: _c, ...body } = req.body; // the customer of a subscription cannot change
  Object.assign(sub, toDoc({ ...body, customer: sub.customer }));
  await sub.save();
  const [customer, pub] = await Promise.all([Customer.findById(sub.customer), Publication.findById(sub.publication)]);
  await audit(req, 'subscription.updated', 'Subscription', sub._id, `Updated ${customer?.name}'s subscription to ${pub?.name}`);
  res.json(await sub.populate('publication', 'name type frequency active'));
}

export async function remove(req, res) {
  const sub = await Subscription.findByIdAndDelete(req.params.id).populate('publication', 'name');
  if (!sub) throw notFound('Subscription not found');
  await audit(req, 'subscription.deleted', 'Subscription', sub._id, `Removed subscription to ${sub.publication?.name}`);
  res.json({ ok: true });
}

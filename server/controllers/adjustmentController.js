import { Customer, DeliveryAdjustment } from '../models/index.js';
import { daysInMonth } from '../services/billing.js';
import { notFound, parseDate } from '../utils/http.js';

export async function list(req, res) {
  const { customer, year, month } = req.query;
  const query = { customer };
  if (year && month) {
    const y = Number(year);
    const m = Number(month);
    query.date = {
      $gte: new Date(Date.UTC(y, m - 1, 1)),
      $lte: new Date(Date.UTC(y, m - 1, daysInMonth(y, m))),
    };
  }
  const items = await DeliveryAdjustment.find(query).populate('publication', 'name').sort({ date: 1 });
  res.json(items);
}

export async function create(req, res) {
  const customer = await Customer.findById(req.body.customer);
  if (!customer) throw notFound('Customer not found');
  const adj = await DeliveryAdjustment.create({ ...req.body, date: parseDate(req.body.date) });
  res.status(201).json(await adj.populate('publication', 'name'));
}

export async function remove(req, res) {
  const adj = await DeliveryAdjustment.findByIdAndDelete(req.params.id);
  if (!adj) throw notFound('Adjustment not found');
  res.json({ ok: true });
}

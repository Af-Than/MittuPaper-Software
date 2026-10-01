import { FuelEntry, Vehicle } from '../models/index.js';
import { notFound, paging, parseIST } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { formatPaise } from '../utils/money.js';

const NOT_DELETED = { deletedAt: null };

export async function list(req, res) {
  const { vehicle, employee, from, to } = req.query;
  const { page, limit, skip } = paging(req.query, 20, 200);
  const query = { ...NOT_DELETED };
  if (vehicle) query.vehicle = vehicle;
  if (employee) query.employee = employee;
  if (from || to) query.fuelledAt = { ...(from ? { $gte: parseDate(from) } : {}), ...(to ? { $lte: parseDate(to) } : {}) };

  const [total, items, sumRows] = await Promise.all([
    FuelEntry.countDocuments(query),
    FuelEntry.find(query).populate('vehicle', 'registrationNumber type').populate('employee', 'name').sort({ fuelledAt: -1 }).skip(skip).limit(limit).lean(),
    FuelEntry.aggregate([{ $match: query }, { $group: { _id: null, amount: { $sum: '$amount' }, litres: { $sum: '$litres' } } }]),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), totals: sumRows[0] || { amount: 0, litres: 0 } });
}

export async function create(req, res) {
  const vehicle = await Vehicle.findOne({ _id: req.body.vehicle, ...NOT_DELETED });
  if (!vehicle) throw notFound('Vehicle not found');
  const entry = await FuelEntry.create({
    ...req.body,
    employee: req.body.employee || vehicle.assignedEmployee || null,
    fuelledAt: parseIST(req.body.fuelledAt),
    createdBy: req.admin.id,
  });
  if (entry.odometer > vehicle.odometer) {
    vehicle.odometer = entry.odometer;
    await vehicle.save();
  }
  await audit(req, 'fuel.recorded', 'FuelEntry', entry._id, `Fuel for ${vehicle.registrationNumber}: ${entry.litres}L, ${formatPaise(entry.amount)}`);
  res.status(201).json(await entry.populate('vehicle', 'registrationNumber type'));
}

export async function update(req, res) {
  const entry = await FuelEntry.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!entry) throw notFound('Fuel entry not found');
  Object.assign(entry, req.body, { fuelledAt: req.body.fuelledAt ? parseIST(req.body.fuelledAt) : entry.fuelledAt });
  await entry.save();
  await audit(req, 'fuel.updated', 'FuelEntry', entry._id, `Updated fuel entry (${formatPaise(entry.amount)})`);
  res.json(entry);
}

export async function remove(req, res) {
  const entry = await FuelEntry.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!entry) throw notFound('Fuel entry not found');
  entry.deletedAt = new Date();
  await entry.save();
  await audit(req, 'fuel.deleted', 'FuelEntry', entry._id, `Removed fuel entry (${formatPaise(entry.amount)})`);
  res.json({ ok: true });
}

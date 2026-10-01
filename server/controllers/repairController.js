import { RepairEntry, Vehicle } from '../models/index.js';
import { notFound, paging, parseDate, parseIST } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { formatPaise } from '../utils/money.js';

const NOT_DELETED = { deletedAt: null };

export async function list(req, res) {
  const { vehicle, category, status, from, to } = req.query;
  const { page, limit, skip } = paging(req.query, 20, 200);
  const query = { ...NOT_DELETED };
  if (vehicle) query.vehicle = vehicle;
  if (category) query.category = category;
  if (status) query.status = status;
  if (from || to) query.repairedAt = { ...(from ? { $gte: parseDate(from) } : {}), ...(to ? { $lte: parseDate(to) } : {}) };

  const [total, items, sumRows] = await Promise.all([
    RepairEntry.countDocuments(query),
    RepairEntry.find(query).populate('vehicle', 'registrationNumber type').sort({ repairedAt: -1 }).skip(skip).limit(limit).lean(),
    RepairEntry.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$total' } } }]),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), totals: { total: sumRows[0]?.total || 0 } });
}

export async function create(req, res) {
  const vehicle = await Vehicle.findOne({ _id: req.body.vehicle, ...NOT_DELETED });
  if (!vehicle) throw notFound('Vehicle not found');
  const total = req.body.total ?? req.body.partsCost + req.body.labourCost;
  const entry = await RepairEntry.create({ ...req.body, total, repairedAt: parseIST(req.body.repairedAt), createdBy: req.admin.id });
  if (entry.odometer && entry.odometer > vehicle.odometer) vehicle.odometer = entry.odometer;
  if (entry.status === 'completed') {
    vehicle.lastServiceDate = entry.repairedAt;
    if (entry.nextServiceKm) vehicle.nextServiceDueKm = entry.nextServiceKm;
  }
  await vehicle.save();
  await audit(req, 'repair.recorded', 'RepairEntry', entry._id, `${entry.category} for ${vehicle.registrationNumber}: ${formatPaise(entry.total)}`);
  res.status(201).json(await entry.populate('vehicle', 'registrationNumber type'));
}

export async function update(req, res) {
  const entry = await RepairEntry.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!entry) throw notFound('Repair entry not found');
  const body = { ...req.body };
  if (body.repairedAt) body.repairedAt = parseIST(body.repairedAt);
  if (body.nextServiceDate) body.nextServiceDate = parseDate(body.nextServiceDate);
  Object.assign(entry, body);
  if (req.body.total == null && (req.body.partsCost != null || req.body.labourCost != null)) entry.total = entry.partsCost + entry.labourCost;
  await entry.save();
  await audit(req, 'repair.updated', 'RepairEntry', entry._id, `Updated ${entry.category} repair (${formatPaise(entry.total)})`);
  res.json(entry);
}

export async function remove(req, res) {
  const entry = await RepairEntry.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!entry) throw notFound('Repair entry not found');
  entry.deletedAt = new Date();
  await entry.save();
  await audit(req, 'repair.deleted', 'RepairEntry', entry._id, `Removed ${entry.category} repair (${formatPaise(entry.total)})`);
  res.json({ ok: true });
}

import { FuelEntry, RepairEntry, Vehicle } from '../models/index.js';
import { averageMileage, costPerKm } from '../services/expenses.js';
import { escapeRegex, notFound, paging } from '../utils/http.js';
import { audit } from '../utils/audit.js';

const NOT_DELETED = { deletedAt: null };
const monthRange = () => {
  const d = new Date();
  return { $gte: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)), $lt: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)) };
};

export async function list(req, res) {
  const { q, employee, type, status } = req.query;
  const { page, limit, skip } = paging(req.query, 16, 100);
  const query = { ...NOT_DELETED };
  if (q && q.trim()) query.registrationNumber = new RegExp(escapeRegex(q.trim()), 'i');
  if (employee) query.assignedEmployee = employee;
  if (type) query.type = type;
  if (status) query.status = status;

  const [total, vehicles] = await Promise.all([
    Vehicle.countDocuments(query),
    Vehicle.find(query).populate('assignedEmployee', 'name').sort({ registrationNumber: 1 }).skip(skip).limit(limit).lean(),
  ]);
  const ids = vehicles.map((v) => v._id);
  const range = monthRange();
  const [fuelRows, repairRows] = await Promise.all([
    FuelEntry.aggregate([{ $match: { ...NOT_DELETED, vehicle: { $in: ids }, fuelledAt: range } }, { $group: { _id: '$vehicle', sum: { $sum: '$amount' } } }]),
    RepairEntry.aggregate([{ $match: { ...NOT_DELETED, vehicle: { $in: ids }, repairedAt: range } }, { $group: { _id: '$vehicle', sum: { $sum: '$total' } } }]),
  ]);
  const fuelMap = new Map(fuelRows.map((r) => [String(r._id), r.sum]));
  const repairMap = new Map(repairRows.map((r) => [String(r._id), r.sum]));
  const items = vehicles.map((v) => ({ ...v, monthCost: (fuelMap.get(String(v._id)) || 0) + (repairMap.get(String(v._id)) || 0) }));
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function get(req, res) {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, ...NOT_DELETED }).populate('assignedEmployee', 'name phone').lean();
  if (!vehicle) throw notFound('Vehicle not found');
  const [fuel, repairs] = await Promise.all([
    FuelEntry.find({ vehicle: vehicle._id, ...NOT_DELETED }).sort({ fuelledAt: 1 }).lean(),
    RepairEntry.find({ vehicle: vehicle._id, ...NOT_DELETED }).sort({ repairedAt: -1 }).lean(),
  ]);
  const totalFuel = fuel.reduce((n, f) => n + f.amount, 0);
  const totalRepairs = repairs.reduce((n, r) => n + r.total, 0);
  const firstOdo = fuel[0]?.odometer ?? vehicle.odometer;
  const kmCovered = Math.max(0, vehicle.odometer - firstOdo);
  res.json({
    ...vehicle,
    fuel,
    repairs,
    stats: {
      totalSpent: totalFuel + totalRepairs,
      totalFuel,
      totalRepairs,
      averageMileage: averageMileage(fuel.map((f) => ({ id: f._id, fuelledAt: f.fuelledAt, odometer: f.odometer, litres: f.litres, fullTank: f.fullTank }))),
      costPerKm: costPerKm({ fuelTotal: totalFuel, repairTotal: totalRepairs, kmCovered }),
    },
  });
}

export async function create(req, res) {
  const vehicle = await Vehicle.create({ ...req.body, createdBy: req.admin.id });
  await audit(req, 'vehicle.created', 'Vehicle', vehicle._id, `Added vehicle ${vehicle.registrationNumber}`);
  res.status(201).json(vehicle);
}

export async function update(req, res) {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!vehicle) throw notFound('Vehicle not found');
  Object.assign(vehicle, req.body);
  await vehicle.save();
  await audit(req, 'vehicle.updated', 'Vehicle', vehicle._id, `Updated vehicle ${vehicle.registrationNumber}`);
  res.json(vehicle);
}

export async function remove(req, res) {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, ...NOT_DELETED });
  if (!vehicle) throw notFound('Vehicle not found');
  vehicle.deletedAt = new Date();
  await vehicle.save();
  await audit(req, 'vehicle.deleted', 'Vehicle', vehicle._id, `Removed vehicle ${vehicle.registrationNumber}`);
  res.json({ ok: true });
}

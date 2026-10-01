import { Publication, Subscription } from '../models/index.js';
import { notFound, parseDate } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { formatPaise } from '../utils/money.js';
import { rateOn, toKey } from '../services/billing.js';

/** Adds currentRate (paise, effective today) and rates sorted newest first. */
function present(p) {
  const obj = p.toObject ? p.toObject() : p;
  const today = new Date().toISOString().slice(0, 10);
  const rates = [...(obj.rates || [])].sort((a, b) => (toKey(a.effectiveFrom) < toKey(b.effectiveFrom) ? 1 : -1));
  const currentRate = rateOn(obj.rates, today);
  // The rate entry effective today, newest first among those already in effect — its agency cost is "current".
  const currentEntry = rates.find((r) => toKey(r.effectiveFrom) <= today) || rates[rates.length - 1];
  const currentAgencyCost = currentEntry?.agencyCostPerCopy || 0;
  return { ...obj, rates, currentRate, currentAgencyCost, currentMargin: currentRate - currentAgencyCost };
}

export async function list(req, res) {
  const query = {};
  if (req.query.type) query.type = req.query.type;
  const pubs = await Publication.find(query).collation({ locale: 'en' }).sort({ name: 1 });
  const counts = await Subscription.aggregate([
    { $match: { $or: [{ endDate: null }, { endDate: { $gte: new Date() } }] } },
    { $group: { _id: '$publication', n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(pubs.map((p) => ({ ...present(p), subscribers: countMap.get(String(p._id)) || 0 })));
}

export async function create(req, res) {
  const { initialRate, agencyCost, effectiveFrom, ...data } = req.body;
  const start = effectiveFrom || new Date().toISOString().slice(0, 10);
  const pub = await Publication.create({
    ...data,
    rates: [{ ratePerCopy: initialRate, agencyCostPerCopy: agencyCost || 0, effectiveFrom: parseDate(start), setBy: req.admin.name }],
  });
  await audit(req, 'publication.created', 'Publication', pub._id, `Added ${pub.name} at ${formatPaise(initialRate)}/copy`);
  res.status(201).json(present(pub));
}

export async function update(req, res) {
  const pub = await Publication.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!pub) throw notFound('Publication not found');
  await audit(req, 'publication.updated', 'Publication', pub._id, `Updated ${pub.name}${req.body.active === false ? ' (deactivated)' : ''}`);
  res.json(present(pub));
}

/**
 * Add a rate. History is append-only: a new entry never rewrites older ones, so past bills
 * keep using the rate that was effective on their dates. Re-entering the same effective date
 * corrects that entry.
 */
export async function addRate(req, res) {
  const pub = await Publication.findById(req.params.id);
  if (!pub) throw notFound('Publication not found');
  const { ratePerCopy, agencyCostPerCopy = 0, effectiveFrom } = req.body;
  const when = parseDate(effectiveFrom);
  const previous = rateOn(pub.rates, effectiveFrom);
  const same = pub.rates.find((r) => toKey(r.effectiveFrom) === effectiveFrom);
  if (same) {
    same.ratePerCopy = ratePerCopy;
    same.agencyCostPerCopy = agencyCostPerCopy;
    same.setBy = req.admin.name;
    same.createdAt = new Date();
  } else {
    pub.rates.push({ ratePerCopy, agencyCostPerCopy, effectiveFrom: when, setBy: req.admin.name });
  }
  await pub.save();
  await audit(
    req,
    'rate.changed',
    'Publication',
    pub._id,
    `${pub.name}: ${formatPaise(previous)} → ${formatPaise(ratePerCopy)} per copy, effective ${effectiveFrom}`
  );
  res.status(201).json(present(pub));
}

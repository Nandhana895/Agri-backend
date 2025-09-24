const mongoose = require('mongoose');

const marketPriceSchema = new mongoose.Schema({
  crop: { type: String, required: true, index: true },
  region: { type: String, required: true, index: true },
  mandi: { type: String, required: true },
  date: { type: Date, required: true, index: true },
  minPrice: { type: Number, default: 0 },
  maxPrice: { type: Number, default: 0 },
  modalPrice: { type: Number, default: 0 },
  source: { type: String, default: 'Agmarknet' }
}, { timestamps: true });

// Compound index for fast queries by crop/region/date
marketPriceSchema.index({ crop: 1, region: 1, date: -1 });

// Helper: get latest-day prices for crop-region
marketPriceSchema.statics.getLatestPrices = async function(crop, region) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // try today
  let rows = await this.find({ crop, region, date: { $gte: start, $lt: end } }).sort({ mandi: 1 });
  if (rows.length > 0) return rows;
  // fallback: most recent day
  const last = await this.find({ crop, region }).sort({ date: -1 }).limit(1).select('date');
  if (!last[0]) return [];
  const d = new Date(last[0].date);
  const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const de = new Date(ds); de.setDate(de.getDate() + 1);
  rows = await this.find({ crop, region, date: { $gte: ds, $lt: de } }).sort({ mandi: 1 });
  return rows;
};

// Helper: get trend for last N days
marketPriceSchema.statics.getPriceTrend = async function(crop, region, days = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Number(days));
  return await this.find({ crop, region, date: { $gte: start, $lte: end } }).sort({ date: 1 });
};

module.exports = mongoose.model('MarketPrice', marketPriceSchema);




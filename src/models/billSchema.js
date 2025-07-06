const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  month: String,
  totalLiters: Number,
  amount: Number,
  status: { type: String, enum: ['paid', 'unpaid'], default: 'unpaid' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bill', billSchema);

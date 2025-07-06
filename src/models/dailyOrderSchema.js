const mongoose = require('mongoose');

const dailyOrderSchema = new mongoose.Schema({
  date: { type: String ,required:true},
  shift: { type: String, enum: ['morning', 'evening'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, default: 0 },
  isActive: { type: Boolean, default: false },
  status: { type: String, enum: ['ordered', 'skipped'], required: true }
});

module.exports = mongoose.model('DailyOrder', dailyOrderSchema);
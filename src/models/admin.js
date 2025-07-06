const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;

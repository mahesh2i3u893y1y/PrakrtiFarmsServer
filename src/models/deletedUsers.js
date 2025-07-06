const mongoose = require("mongoose");

const deletedUsers = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    userName: { type: String, required: true, unique: true },
    userId: { type: Number, required: true },
    address: {
      flatOrHouseNumber: { type: String },
      apartmentOrBuildingName: { type: String },
      area: { type: String },
      street: { type: String },
      landmark: { type: String },
      pincode: { type: String },
      cityOrTown: { type: String },
      state: { type: String },
      district: { type: String },
    },
    milkPreference: {
      morning: {
        isActive: { type: Boolean, default: false },
        quantity: { type: Number, default: 0 },
      },
      evening: {
        isActive: { type: Boolean, default: false },
        quantity: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("deletedUsers", deletedUsers);

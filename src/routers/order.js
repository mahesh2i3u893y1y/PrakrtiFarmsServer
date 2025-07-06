const express = require("express");
const orderRouter = express.Router();
const User = require("../models/users");
const verifyToken = require("../middlewares/verifyToken"); 
const AdminRouter = require("./admin");
const moment = require("moment-timezone");
const DailyOrder = require("../models/dailyOrderSchema")

orderRouter.post('/milk-preference', verifyToken, async (req, res) => {
  const userId = req.userId; 
  const { milkPreference } = req.body;

  try {
    await User.findByIdAndUpdate(userId, {
      $set: {
        'milkPreference.morning.isActive': milkPreference?.morning?.isActive,
        'milkPreference.morning.quantity': milkPreference?.morning?.quantity,
        'milkPreference.evening.isActive': milkPreference?.evening?.isActive,
        'milkPreference.evening.quantity': milkPreference?.evening?.quantity
      }
    });

    res.json({ message: 'Milk preference updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating preference.', error });
  }

});


orderRouter.get("/orders/todays", async (req, res) => {
  try {
    const todayString = moment().tz("Asia/Kolkata").format("YYYY-DD-MM");
    console.log("Looking for date:", todayString); // Debugging log

    const ordersToday = await DailyOrder.find({ date: todayString }).lean();

    res.json(ordersToday);
  } catch (error) {
    console.error("Error fetching today's orders:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



 
function todayIST_Y_D_M() {
  const [y, m, d] = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-");
  return `${y}-${d}-${m}`;
}

const getShiftOrders = (shift) => async (req, res) => {
  try {
    const dateString = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : todayIST_Y_D_M();

    const users = await DailyOrder.aggregate([
      { $match: { date: dateString, shift } },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      {
        $project: {
          _id: 1,
          shift: 1,
          quantity: 1,
          isActive: 1,
          status: 1,
          user: 1,
          literBottles: { $floor: "$quantity" },
          halfLiterBottles: {
            $cond: [{ $eq: [{ $mod: ["$quantity", 1] }, 0.5] }, 1, 0],
          },
        },
      },

      {
        $group: {
          _id: "$user._id",
          name: { $first: "$user.name" },
          userId: { $first: "$user.userId" },
          phone: { $first: "$user.phone" },
          userName: { $first: "$user.userName" },
          address: { $first: "$user.address" },

          orders: {
            $push: {
              _id: "$_id",
              shift: "$shift",
              quantity: "$quantity",
              isActive: "$isActive",
              status: "$status",
            },
          },

          totalQuantity: { $sum: "$quantity" },
          literBottles: { $sum: "$literBottles" },
          halfLiterBottles: { $sum: "$halfLiterBottles" },
        },
      },
    ]);

    const grandTotals = users.reduce(
      (acc, u) => ({
        totalLiters: acc.totalLiters + u.totalQuantity,
        literBottles: acc.literBottles + u.literBottles,
        halfLiterBottles: acc.halfLiterBottles + u.halfLiterBottles,
      }),
      { totalLiters: 0, literBottles: 0, halfLiterBottles: 0 }
    );

    res.json({ users, grandTotals });
  } catch (error) {
    console.error(`Error fetching ${shift} orders:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Morning orders
orderRouter.get("/orders/morning", getShiftOrders("morning"));

// Evening orders
orderRouter.get("/orders/evening", getShiftOrders("evening"));

module.exports = orderRouter;

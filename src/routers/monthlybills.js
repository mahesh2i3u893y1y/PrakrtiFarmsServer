// routes/bill.routes.js
const express = require("express");
const router = express.Router();

const Bill = require("../models/billSchema");
const DailyOrder = require("../models/dailyOrderSchema");
const User = require("../models/users"); // <- adjust the path if different

function splitYDM(str) {
  const [y, d, m] = str.split("-").map(Number);
  return { y, d, m };
}

/**
 * For a given "YYYY-MM" string (e.g. "2025-06") return:
 *  { monthRegex, isCurrentMonth, currentDay }
 *
 *  monthRegex   →   /^2025-\d{2}-06$/   (matches every day in that month)
 */
function buildMonthContext(monthStr) {
  const [yStr, mStr] = monthStr.split("-");
  const year = Number(yStr);
  const month = Number(mStr); // 1-based (01 → Jan)

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;

  const currentDay = isCurrentMonth ? today.getDate() : 31; // safe upper bound

  const monthRegex = new RegExp(`^${year}-\\d{2}-${mStr}$`); // ^2025-\d{2}-06$

  return { monthRegex, isCurrentMonth, currentDay };
}


const MILK_RATE_PER_LTR = 90; 


router.get("/:userId/:month", async (req, res) => {
  try {
    const { userId, month } = req.params;
    const { monthRegex, isCurrentMonth, currentDay } = buildMonthContext(month);

    /* 1. Pull every shift (morning + evening) that belongs to that month */
    const rawOrders = await DailyOrder.find({
      userId,
      date: { $regex: monthRegex },
    }).sort({ date: 1, shift: 1 });

    /* 2. If it’s the current month, keep only days ≤ today */
    const dailyOrders = isCurrentMonth
      ? rawOrders.filter((o) => splitYDM(o.date).d <= currentDay)
      : rawOrders;

    /* 3. Sum litres for status === 'ordered' only */
    const totalLiters = dailyOrders.reduce(
      (sum, row) => (row.status === "ordered" ? sum + row.quantity : sum),
      0
    );
    const amount = totalLiters * MILK_RATE_PER_LTR;

    /* 4. Upsert / refresh the Bill */
    const bill = await Bill.findOneAndUpdate(
      { userId, month },
      { totalLiters, amount },
      { new: true, upsert: true }
    );

    res.json({ bill, dailyOrders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:month", async (req, res) => {
  try {
    const { month } = req.params; // "2025-06"
    const { monthRegex, isCurrentMonth, currentDay } = buildMonthContext(month);

    const rawOrders = await DailyOrder.find({
      date: { $regex: monthRegex },
      status: "ordered",
    }).select("userId quantity date shift status");

    const orders = isCurrentMonth
      ? rawOrders.filter((o) => splitYDM(o.date).d <= currentDay)
      : rawOrders;

    if (orders.length === 0) {
      return res.status(200).json([]); // ✅ No orders at all, return empty array (frontend will show "No orders")
    }

    const ordersByUser = new Map();
    const litresByUser = new Map();

    orders.forEach((o) => {
      const uid = String(o.userId);
      if (!ordersByUser.has(uid)) ordersByUser.set(uid, []);
      ordersByUser.get(uid).push(o);
      litresByUser.set(uid, (litresByUser.get(uid) || 0) + o.quantity);
    });

    const userIds = Array.from(ordersByUser.keys());

    const users = await User.find({ _id: { $in: userIds } })
      .select("name phone userName address userId")
      .lean();

    const results = await Promise.all(
      users.map(async (u) => {
        const uid = String(u._id);
        const litres = litresByUser.get(uid) || 0;
        const dailyOrders = ordersByUser.get(uid) || [];

        const bill = await Bill.findOneAndUpdate(
          { userId: uid, month },
          { totalLiters: litres, amount: litres * MILK_RATE_PER_LTR },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();

        return { user: u, bill, dailyOrders };
      })
    );

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// PATCH /api/bills/:billId
router.post("/bills/:billId", async (req, res) => {
  try {
    const { billId } = req.params;
    const { status } = req.body;

    // Validate input
    if (!["paid", "unpaid"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be 'paid' or 'unpaid'." });
    }

    // Update bill
    const updatedBill = await Bill.findByIdAndUpdate(
      billId,
      { status },
      { new: true }
    ).lean();

    if (!updatedBill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    res.json({ message: "Payment status updated", bill: updatedBill });
  } catch (err) {
    console.error("Error updating payment status:", err);
    res.status(500).json({ error: "Server error" });
  }
});



router.get("/monthlybills/summary/:month", async (req, res) => {
  try {
    const { month } = req.params; // example: "2025-06"

    // Find all bills for the requested month
    const bills = await Bill.find({ month });

    if (bills.length === 0) {
      return res.json({ message: "No bills this month" });
    }

    // Initialize summary variables
    let paidCount = 0;
    let unpaidCount = 0;
    let totalAmount = 0;
    let collectedAmount = 0;
    let pendingAmount = 0;
    let totalLiters = 0;

    bills.forEach((bill) => {
      const status = bill.status?.toLowerCase().trim();
      const amount = bill.amount || 0;
      totalAmount += amount;
      const liters = bill.totalLiters || 0; 
      totalLiters += liters

      if (status === "paid") {
        paidCount++;
        collectedAmount += amount;
      } else if (status === "unpaid") {
        unpaidCount++;
        pendingAmount += amount;
      }
    });

    return res.json({
      month,
      totalBills: bills.length,
      paidCount,
      unpaidCount,
      totalAmount,
      collectedAmount,
      pendingAmount,
      totalLiters
    });
  } catch (error) {
    console.error("Error fetching monthly summary:", error);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;

const cron = require("node-cron");
const moment = require("moment-timezone");
const User = require("../models/users");
const DailyOrder = require("../models/dailyOrderSchema");

const generateShiftOrders = async (shift) => {
  const todayIST = moment().tz("Asia/Kolkata").format("YYYY-DD-MM");


  const users = await User.find();
  const orders = users.map((user) => {
    const pref = user.milkPreference?.[shift] || {};
    const isActive = pref.isActive || false;
    const quantity = isActive ? pref.quantity : 0;

    return {
      date: todayIST,
      shift,
      userId: user._id,
      quantity,
      isActive,
      status: isActive ? "ordered" : "skipped",
    };
  });

  await DailyOrder.insertMany(orders);
  console.log(
    `[${new Date().toISOString()}] ✅ ${shift} milk orders generated.`
  );
};

cron.schedule('30 23 * * *', () => generateShiftOrders('morning'), {
  timezone: 'Asia/Kolkata'
});

cron.schedule("30 23 * * *", () => generateShiftOrders("evening"));


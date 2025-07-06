const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const cors = require("cors")
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: "https://prakrtifarms.vercel.app", credentials: true }));
require('./src/cronJobs/generateDailyOrders');

const {connectDb} = require("./src/config/database")
const PORT = 3000 

const authRouter = require("./src/routers/auth")
const orderRouter = require("./src/routers/order")
const AdminRouter = require("./src/routers/admin");
const router = require("./src/routers/monthlybills")


app.use("/", authRouter)
app.use("/",orderRouter)
app.use("/",AdminRouter)
app.use("/",router)





connectDb().then(() => {
    console.log("Database connect successfully")
    app.listen(PORT , () => {
        console.log("Server running on the http://localhost:3000/")
    })
}).catch((err) => {
    console.log("Failed to Connect Database!!!")
})
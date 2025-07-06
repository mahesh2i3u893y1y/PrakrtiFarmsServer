const Admin = require("../models/admin")
const express = require("express")
const AdminRouter = express.Router()
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt")

const JWT_SECRET = "PRAKRTI@2025";


AdminRouter.post("/admin/signup", async (req, res) => {
  try {
    const { adminName, password } = req.body;

    if(!adminName || !password) return  res.status(400).json({ message: "Admin name or password missing" });

    const adminExists = await Admin.findOne({ adminName });
    if (adminExists) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const encrptPassword = await bcrypt.hash(password,10)

    // Create new admin
    const newAdmin = new Admin({ adminName, password:encrptPassword });
    await newAdmin.save();

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        id: newAdmin._id,
        adminName: newAdmin.adminName,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
});


AdminRouter.post("/admin/login", async (req, res) => {
  try {
    const { adminName, password } = req.body;

    if (!adminName || !password) {
      return res.status(400).json({ message: "Please provide both userName and password" });
    }

    const admin = await Admin.findOne({ adminName });
    if (!admin) return res.status(404).json({ message: "admin not found" });

    const hashedPasswordFromDB = admin.password
    const isPasswordMatch = await bcrypt.compare(password, hashedPasswordFromDB);

    if(!isPasswordMatch) return res.status(400).json({ message: "Password didn't match" });
    
    const AdminToken = jwt.sign({ adminId: admin._id }, JWT_SECRET);

    // Send token in HTTP-only cookie
    res.cookie("AdminToken", AdminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.status(200).json({
      message: "Login successful",
      admin
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});




AdminRouter.get('/admin/me', (req, res) => {
  try {
    const AdminToken = req.cookies.AdminToken;
    if (!AdminToken) return res.status(401).json({ message: 'Not authenticated' });

    const decoded = jwt.verify(AdminToken, JWT_SECRET);
    const adminId = decoded.adminId;

    Admin.findById(adminId).then(admin => {
      if (!admin) return res.status(404).json({ message: 'User not found' });
      res.status(200).json({
      message: "successful",
      admin
    });

    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});



AdminRouter.post("/admin/logout", (req, res) => {
  res.clearCookie("AdminToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });
  res.status(200).json({ message: "Logged out successfully" });
});


module.exports = AdminRouter
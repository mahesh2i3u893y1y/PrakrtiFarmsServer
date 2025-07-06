const express = require("express");
const User = require("../models/users");
const authRouter = express.Router();
const jwt = require("jsonwebtoken");
const verifyToken = require("../middlewares/verifyToken");
const deletedUsers = require("../models/deletedUsers");

const JWT_SECRET = "PRAKRTI@2025";

// Register User

const generateUniqueUserId = async () => {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const randomId = Math.floor(Math.random() * 9999) + 1;
    const existing = await User.findOne({ userId: randomId });
    const existingInDeleted = await deletedUsers.findOne({userId:randomId})
    if (!existing && !existingInDeleted) {
      return randomId;
    }
  }

  throw new Error("Failed to generate unique userId after multiple attempts");
};

authRouter.post("/register", async (req, res) => {
  try {
    const { name, phone, userName, address } = req.body;
    const userId = await generateUniqueUserId();

    // Check if phone number already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this phone number already exists" });
    }

    const existUserName = await User.findOne({ userName });
    if (existUserName) {
      return res.status(400).json({ message: "userName already exists" });
    }

    const newUser = new User({
      name,
      userId,
      phone,
      userName,
      address,
    });

    await newUser.save();
    res
      .status(201)
      .json({ message: "User registered successfully", user: newUser });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Login User
authRouter.post("/login", async (req, res) => {
  try {
    const { userName, password } = req.body;

    if (!userName || !password) {
      return res.status(400).json({ message: "Please provide both userName and password" });
    }

    const user = await User.findOne({ userName });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Temporary: password is phone number
    if (user.phone !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // JWT without expiry (user stays logged in until logout)
    const token = jwt.sign({ userId: user._id }, JWT_SECRET);

    // Send token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict"
    });

    res.status(200).json({
      message: "Login successful",
      user
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


authRouter.post('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const update = req.body;

    const updatedUser = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});


authRouter.delete('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Step 1: Get the document (Mongoose Document)
    const userDoc = await User.findById(userId);
    if (!userDoc) return res.status(404).json({ message: 'User not found.' });

    // Step 2: Convert to plain object
    const userObject = userDoc.toObject();

    // Step 3: Save in deleted collection
    await deletedUsers.create(userObject);

    // Step 4: Delete from original
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'User soft-deleted successfully.' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});



authRouter.post('/user/restore/:id', async (req, res) => {
  try {
    const delId = req.params.id;

    // 1. Fetch from DeletedUsers
    const deletedDoc = await deletedUsers.findById(delId);
    if (!deletedDoc) return res.status(404).json({ message: 'Deleted user not found.' });

    // 2. Remove its _id so we can insert as new
    const { _id, createdAt, updatedAt, __v, ...payload } = deletedDoc.toObject();

    // 3. Handle unique collisions (phone / userName)
    const clash = await User.findOne({
      $or: [{ phone: payload.phone }, { userName: payload.userName }],
    });
    if (clash) {
      return res
        .status(409)
        .json({ message: 'A user with same phone or userName already exists.' });
    }

    // 4. Insert back to Users
    const restored = await User.create(payload);

    // 5. Remove from DeletedUsers
    await deletedUsers.findByIdAndDelete(delId);

    res.status(200).json({ message: 'User restored.', user: restored });
  } catch (err) {
    console.error('Error restoring user:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

authRouter.get('/getalldeletedusers', async (req, res) => {
  try {
    const users = await deletedUsers.find().sort({ createdAt: -1 }); 
    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

authRouter.get('/me', (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    User.findById(userId).then(user => {
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.status(200).json({
      message: "successful",
      user
    });

    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});


authRouter.get('/getallusers', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }); 
    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


authRouter.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });
  res.status(200).json({ message: "Logged out successfully" });
});






authRouter.get("/profile", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  res.json({ user });
});


module.exports = authRouter;

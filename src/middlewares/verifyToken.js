const jwt = require("jsonwebtoken");
const JWT_SECRET = "PRAKRTI@2025";

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ message: "No token provided." });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token." });
  }
};

module.exports = verifyToken;

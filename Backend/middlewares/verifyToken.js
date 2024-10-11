import jwt from "jsonwebtoken"; // Correct import

export const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Using jwt.verify to verify the token

    if (!decoded) {
      return res.status(401).json({ success: false, message: "Invalid Token" });
    }

    req.userId = decoded.userId;
    next(); // Proceed to the next middleware if the token is valid
  } catch (error) {
    console.error(`Error verifying token: `, error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

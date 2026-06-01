import jwt from "jsonwebtoken"; 

export const verifyToken = async (req, res, next) => {
  // Extract token from 'Bearer <token>'
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized - no token provided" });
  }

  try {
    // Change 1: Fixed 'ify' to 'jwt.verify'
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If verification succeeds, decoded is guaranteed to exist
    req.userId = decoded.userId;
    next(); 
  } catch (error) {
    console.error(`Error verifying token: `, error);
    
    // Change 2 & 3: Handle token errors gracefully with 401 instead of 500
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
    
    // Genuine internal server errors still get a 500
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
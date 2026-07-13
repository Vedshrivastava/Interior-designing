import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordTokenExpiresAt: Date,
    verificationToken: String,
    verificationTokenExpiresAt: Date,
    role: {
      type: String,
      enum: ["MASTER", "ADMIN", "USER"],
      default: "USER",
      required: true,
    },
    // Finance-module visibility only — not a field/action-level permission
    // system. Unset (the default for every existing user) or role MASTER
    // means full access, same as before this field existed. Set on an
    // ADMIN user to restrict which finance sidebar sections/routes they
    // can reach — see components/sidebar.jsx and ProtectedRoute.jsx.
    allowedFinanceModules: { type: [String], default: undefined },
    cartData: { type: Object, default: {} },
  },
  { minimize: false }
);

const userModel = mongoose.models.user || mongoose.model("User", userSchema);
export default userModel;
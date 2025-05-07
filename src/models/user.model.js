import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,  // Add index for faster search
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true,  // Add index for faster search
    },
    password: {
        type: String,  // hashed password (should be encrypted)
        required: [true, "Password is required"],
    },
    watchHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Video",
    }],
    avatar: {
        type: String,   // cloudinary url
        required: true,
    },
    coverImage: {
        type: String,  // cloudinary url
    },
    refreshToken: {
        type: String,
    }
}, {timestamps: true});  // Add timestamps for createdAt and updatedAt

// Hash password before saving (use Pre hook --> middleware)
// we can't use arrow function here because we need to access the current context (this)
userSchema.pre("save", async function(next) {
    if (!this.isModified("password")) return next();  // If password is not modified, skip hashing
    try {
        const salt = await bcrypt.genSalt(10);  // Generate salt
        this.password = await bcrypt.hash(this.password, salt);  // Hash password
        next();  // Proceed to save the user
    } catch (error) {
        next(error);  // Pass error to the next middleware
    }
});

// Create a new method to check the password
userSchema.methods.isPasswordCorrect = async function(password) { 
    try {
        return await bcrypt.compare(password, this.password);  // Compare password with hashed password
    } catch (error) {
        throw new Error(error);  // Pass error to the next middleware
    }
}

// Create a new method to generate JWT Access token
userSchema.methods.generateAccessToken = function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName,
        },
        process.env.JWT_ACCESS_TOKEN_SECRET,  // Secret key
        {expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN}  // Expiration time
    )
}

// Create a new method to generate JWT Refresh token
userSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.JWT_REFRESH_TOKEN_SECRET,  // Secret key
        {expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN}  // Expiration time
    )
}

export const User = mongoose.model("User", userSchema)
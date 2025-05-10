import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({
    //     message: "ok",
    // })

    // Steps to register a user:
    // get the user details from the frontend (req.body)
    // validation of the user details (email, password, etc.) [not empty]
    // check if the user already exists in the database (using username or email)
    // check for images, check for avatar
    // upload them to cloudinary, (eg. avatar)
    // create user object & create entry in the database (using mongoose)
    // remove password (encrypted) and refresh token (empty field) fields from the response
    // check for user creation success or failure (response)
    // return response to the frontend (success or failure)

    const { fullName, username, email, password } = req.body;
    console.log("email: ", email);

    // validate user details together using some() function
    if (
        [fullName, username, email, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }
    // validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // simple regex to validate email format
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid email format");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        throw new ApiError(
            409,
            "User with this email or username already exists"
        );
    }

    // avatar is at our local server: (Check of avatar is present)
    const avatarLocalPath = req.files?.avatar[0]?.path; // path by multer
    const coverImageLocalPath = req.files?.coverImage[0]?.path; // path by multer
    console.log("avatarLocalPath: ", avatarLocalPath);

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    // upload images to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = coverImageLocalPath
        ? await uploadOnCloudinary(coverImageLocalPath)
        : null;

    if(!avatar) {
        throw new ApiError(500, "Failed to upload avatar");
    }

    // create user object (enter in the database)
    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,
        password,
        avatar: avatar.secure_url, // cloudinary url
        coverImage: coverImage?.secure_url || "", 
    })

    // remove password and refresh token from the response
    // user.password = undefined; // remove password
    // user.refreshToken = undefined; // remove refresh token

    // remove password and refresh token from the response using select
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    // check for user creation success or failure
    if (!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }

    // return response to the frontend (success or failure)
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
});

export { registerUser };

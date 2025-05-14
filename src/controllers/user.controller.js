import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken; // save refresh token in the database
        await user.save({ validateBeforeSave: false }); // skip validation for refresh token  --> eg. password

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Failed to generate tokens");
    }
};

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
    console.log(req.body);
    console.log(req.files);

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
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path; // path by multer
    }

    console.log("avatarLocalPath: ", avatarLocalPath);
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required");
    }

    // upload images to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = coverImageLocalPath
        ? await uploadOnCloudinary(coverImageLocalPath)
        : null;

    if (!avatar) {
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
    });

    // remove password and refresh token from the response
    // user.password = undefined; // remove password
    // user.refreshToken = undefined; // remove refresh token

    // remove password and refresh token from the response using select
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    // check for user creation success or failure
    if (!createdUser) {
        throw new ApiError(500, "Failed to create user");
    }

    // return response to the frontend (success or failure)
    return res
        .status(201)
        .json(
            new ApiResponse(200, createdUser, "User registered successfully")
        );
});

const loginUser = asyncHandler(async (req, res) => {
    // get the user details from the frontend (req.body)
    // username or email based access
    // find the user in the database
    // check the password
    // generate access token and refresh token
    // send cookies
    // return response to the frontend (success or failure)

    const { email, username, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "Username or Email is required");
    }

    // instance of user we get from the database (we can apply methods on 'user', we created in the model)
    const user = await User.findOne({
        $or: [{ email }, { username: username?.toLowerCase() }],
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    // get a new instance of user after updating the refresh token (no need to send password and refresh token)
    const loggedInUser = await User.findById(user._id).select(
        " -password -refreshToken"
    );

    // set cookie options
    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User logged in successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    // reset the refresh token in the database
    // clear the cookies (managed by server --> httponly)

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: undefined },
        },
        {
            new: true,
        }
    );

    const cookieOptions = {
        httpOnly: true,
        secure: true,
        expires: new Date(Date.now()), // set the cookie to expire immediately
    };

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, null, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    // refresh token from the user (cookie or body)
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.JWT_REFRESH_TOKEN_SECRET
        );

        if (!decodedToken) {
            throw new ApiError(401, "Invalid Refresh Token");
        }

        // get the user from the database (using the decoded token)
        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }

        // check if the refresh token in the database is same as the incoming refresh token
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired or used");
        }

        // generate new access token and refresh token
        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        const cookieOptions = {
            httpOnly: true,
            secure: true,
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", newRefreshToken, cookieOptions)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token");
    }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };

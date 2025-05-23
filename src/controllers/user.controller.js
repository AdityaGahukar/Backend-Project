import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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
            // $set: { refreshToken: undefined },
            $unset: {
                refreshToken: 1, // remove the refresh token from the database
            }
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

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isPwdCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPwdCorrect) {
        throw new ApiError(401, "Invalid old password");
    }

    if (oldPassword === newPassword) {
        throw new ApiError(
            400,
            "New password must be different from old password"
        );
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false }); // our password is encrypted using bcryptjs before saving (userSchema pre hook)

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "Current user fetched successfully")
        );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName && !email) {
        throw new ApiError(400, "Full name or email are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email,
            },
        },
        { new: true } // returns the updated user
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path; // path by multer
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is missing");
    }

    // upload avatar to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar.secure_url) {
        throw new ApiError(500, "Failed to upload avatar");
    }

    // for deleting the old avatar from cloudinary
    const currentUser = await User.findById(req.user._id); // Fetch current user to get previous avatar (before update)
    const oldAvatarPublicId = currentUser?.avatar
        ?.split("/")
        .pop()
        .split(".")[0]; // get the public id of the old avatar

    // update user avatar in the database
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.secure_url, // cloudinary url
            },
        },
        { new: true } // returns the updated user
    ).select("-password");

    // delete the old avatar from cloudinary
    if (oldAvatarPublicId) {
        const deleteResult = await deleteFromCloudinary(oldAvatarPublicId);
        if (!deleteResult) {
            throw new ApiError(500, "Failed to delete old avatar");
        }
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path; // path by multer
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image is missing");
    }

    // upload cover image to cloudinary
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage.secure_url) {
        throw new ApiError(500, "Failed to upload cover image");
    }

    // for deleting the old cover image from cloudinary
    const currentUser = await User.findById(req.user._id); // Fetch current user to get previous cover image (before update)
    const oldCoverImagePublicId = currentUser?.coverImage
        ?.split("/")
        .pop()
        .split(".")[0]; // get the public id of the old cover image

    // update user cover image in the database
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage: coverImage.secure_url, // cloudinary url
            },
        },
        { new: true } // returns the updated user
    ).select("-password");

    // delete the old cover image from cloudinary
    if (oldCoverImagePublicId) {
        const deleteResult = await deleteFromCloudinary(oldCoverImagePublicId);
        if (!deleteResult) {
            throw new ApiError(500, "Failed to delete old cover image");
        }
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params; // params from the url
    if (!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    const channel = await User.aggregate([
        // aggregate pipeline to get the user channel profile
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        {
            $lookup: {
                from: "subscriptions", // name of the subscription collection
                localField: "_id", // field in the user collection (current user)
                foreignField: "channel", // field in the subscription collection  --> select the documents with the same channel to get the count of subscribers
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber", // field in the subscription collection  --> select the documents with the same subscriber (user) to get the count of his subscriptions
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                // add new fields to the user object (in the database)
                subscriberCount: { $size: "$subscribers" }, // count of subscribers
                subscribedToCount: { $size: "$subscribedTo" }, // count of subscriptions
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user._id, "$subscribers.subscriber"] }, // check if the user is subscribed to the channel
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                // select the fields to return
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscriberCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
            },
        },
    ]);

    // aggregate returns an array of objects, so we need to get the first object
    if (!channel?.length) {
        throw new ApiError(404, "Channel not found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "Channel profile fetched successfully"
            )
        );
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            owner: { $arrayElemAt: ["$owner", 0] }, // get the first element of the array
                        },
                    },
                ],
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0]?.watchHistory || [],
                "Watch history fetched successfully"
            )
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
};

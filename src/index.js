// require("dotenv").config({path: './env'});

import connectDB from "./db/index.js";

import dotenv from "dotenv";
dotenv.config({ path: "./env" }); // Load environment variables from .env file


connectDB(); // Connect to MongoDB











 
/*
import express from "express";
const app = express();

//  Immediately Invoked Async Function Expression (IIAFE)
;( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("Error in server:", error.message);
            throw error;            
        })

        app.listen(process.env.PORT, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
            console.log(`MongoDB connected to ${DB_NAME}`);
        })
    } catch (error) {
        console.error("Error connecting to MongoDB:", error.message);
        throw error;
    }
})()
*/
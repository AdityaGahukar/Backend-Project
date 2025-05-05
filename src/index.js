// require("dotenv").config({path: './env'});

import connectDB from "./db/index.js";
import { app } from "./app.js";

import dotenv from "dotenv";
dotenv.config({ path: "./.env" }); // Load environment variables from .env file

// Connect to MongoDB
connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on port ${process.env.PORT || 8000}`);
    });
  })
  .catch((err) => {
    console.log("MONGODB CONNECTION FAILED !!!", err);
  });

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

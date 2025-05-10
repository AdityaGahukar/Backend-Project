import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true, // Allow credentials (cookies, authorization headers, etc.) to be sent
}));


app.use(express.json({ limit: "16kb" })); // Parses incoming requests with JSON payloads (e.g., API clients sending JSON)
app.use(express.urlencoded({ extended: true, limit: "16kb" }));  // Parses incoming requests with URL-encoded payloads (e.g., HTML form submissions)
app.use(express.static("public"));  // Serves static files like images, CSS, and JS from the "public" directory
app.use(cookieParser());  // Parses cookies attached to the client request object


// Import routes
import userRouter from './routes/user.routes.js';


// routes declaration
app.use("/api/v1/users", userRouter);  // All user-related routes will be prefixed with "/api/v1/users"
// http://localhost:5000/api/v1/users/register --> done where we declare the routes in user.routes.js

export { app };
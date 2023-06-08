const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
require("../src/db/conn");
const router = require("./router/men")
// const httpServer = require("http").createServer(app);
const dotenv = require('dotenv')
dotenv.config();




const ApiOne = require("../src/modules/mens");
const sendEmail = require("../sendEmail");


const port = process.env.PORT;
const app = express()



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())



app.post('/register', async (req, res) => {
    try {
        const { email, name, password } = req.body;

        // Check if the required fields are provided
        if (!email || !name || !password) {
            return res.status(400).json({ message: 'Username, password, and email are required' });
        }

        // Check if a user already exists with the provided email
        const existingUser = await ApiOne.findOne({ email });
        if (existingUser) {
            return res.status(400).send('User already exists with this email');
        }

        // Encrypt the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a numeric OTP
        const otp = generateNumericOTP(6);

        // Create a new user instance
        const user = new ApiOne({ email, name, password: hashedPassword, otp });

        // Save the user to the database
        const savedUser = await user.save();

        // Generate a JWT token for the user
        const token = jwt.sign(
            { Id: savedUser._id, email },
            process.env.JWT_SECRET_KEY,
            { expiresIn: '2h' }
        );

        savedUser.token = token;

        // Send an email with the OTP for verification
        await sendEmail({
            email: email,
            subject: 'OTP to verify email',
            message: `Your OTP is: ${otp}`
        });

        res.status(201).json(savedUser);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to register user' });
    }
});
// Route: Verify the OTP
app.post("/verify", async (req, res) => {
    try {
        const { otp, email } = req.body;

        // Find the user with the provided email
        const verifyUser = await ApiOne.findOne({ email });

        if (!verifyUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Compare the provided OTP with the one stored in the database
        if (verifyUser.otp === otp) {
            verifyUser.isVerified = true
            verifyUser.save();
            // OTP is valid
            // Perform the desired actions here after successful OTP verification
            // For example, update the user's status, mark the email as verified, etc.

            return res.status(200).json({ message: 'User verified successfully' });
        } else {
            // Invalid OTP
            return res.status(400).json({ message: 'Invalid OTP' });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Failed to verify OTP' });
    }
});


// Function to generate a numeric OTP
function generateNumericOTP(length) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * digits.length);
        otp += digits[randomIndex];
    }
    return otp;
}

app.post("/login", async (req, res) => {
    try {
        // Get email and password from the request body
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).send("Please provide email and password");
        }

        // Find user in the database
        const user = await ApiOne.findOne({ email });

        // Check if the user exists
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Check if the user is verified
        if (!user.isVerified) {
            return res.status(401).json({ message: "User is not verified" });
        }

        // Compare the provided password with the stored password
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Generate a JWT token for the user
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET_KEY, {
            expiresIn: "2h",
        });

        // Remove sensitive fields from the user object
        user.password = undefined;

        // Send token and user information in the response
        res.status(200).json({
            success: true,
            token,
            user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred during login" });
    }
});



app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        // Validation
        if (!email) {
            return res.status(400).json({ message: "Please provide an email" });
        }

        // Find the user in the database
        const user = await ApiOne.findOne({ email });

        // Check if the user exists
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Generate a numeric OTP
        const otp = generateNumericOTP(6);

        // Save the OTP in the user object
        user.otp = otp;
        await user.save();

        // Send the OTP to the user (e.g., via email or SMS)
        // sendOtpToUser(user.email, otp);
        await sendEmail({
            email: email,
            subject: 'OTP to verify email',
            message: `Your OTP is: ${otp}`
        });


        res.status(200).json({ message: "OTP sent for password reset" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred during password reset" });
    }
});




app.post("/reset-password", async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Find the user with the provided email
        const user = await ApiOne.findOne({ email });

        // Check if the user exists
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if the user is verified
        if (!user.isVerified) {
            return res.status(401).json({ message: "User is not verified" });
        }

        // Check if the provided OTP is valid
        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Update the user's password with the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();


        // Return a success response
        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to reset password" });
    }
});




app.get('/register', async (req, res) => {
    try {
        const getLog = await ApiOne.find();
        res.send(getLog)

        res.status(201).json(getLog);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to register user' });
    }
});


app.patch("/register/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const getLog = await ApiOne.findByIdAndUpdate({ _id: id }, req.body, { new: true });
        res.send(getLog)

    } catch (e) {
        console.error(e)
        res.status(500).send("Internal Server Error");
    }
})


app.delete("/register/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const getLog = await ApiOne.findByIdAndDelete({ _id: id }, req.body, { new: true });
        res.send(getLog)

    } catch (e) {
        console.error(e)
        res.status(500).send("Internal Server Error");
    }
})












app.listen(port, () => {
    console.log(`connection is live at port no. ${port}`)
})
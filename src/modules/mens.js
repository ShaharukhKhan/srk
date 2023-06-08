const express = require("express");
const mongoose = require("mongoose");



const logInSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    name: {
        type: String,
        require: true,
        trim: true
    },
    password: {
        type: String,
        require: true,

    },
    otp: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    newPassword: {
        type: String,
        require: true
    },
    status:{type:Boolean,default:true}

});



const ApiOne = new mongoose.model("ApiOne", logInSchema)

module.exports = ApiOne



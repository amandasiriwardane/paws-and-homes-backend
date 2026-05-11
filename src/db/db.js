const {Pool} =require('pg')
require ('dotenv').config()
const fs = require('fs')
const path = require('path')
const createTables = require('./schema')


const pool = new Pool({
    host:process.env.DB_HOST,
    port:process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
    ssl:{
        rejectUnauthorized:false, //just for db to work without ca 
        ca: process.env.DB_CA_CERT
    }

})

//test connection
pool.connect((err,client,release)=>{
    if(err){
        console.error("Database connection error:",err.message)
    }else{
        console.log("Database Connected successfully!")
        createTables(pool)
        release()
    }
})


module.exports = pool;
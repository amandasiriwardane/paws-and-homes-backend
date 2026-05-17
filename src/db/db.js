const {Pool} =require('pg')
require ('dotenv').config()
const fs = require('fs')
const path = require('path')
const createTables = require('./schema')


const pool = new Pool({
    connectionString:process.env.DATABASE_URL,
    ssl:{
        rejectUnauthorized:false, //just for db to work without ca 
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
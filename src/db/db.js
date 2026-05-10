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
        rejectUnauthorized:true,
        ca: fs.readFileSync(path.join(__dirname, '../../ca-615cecce-93b4-4add-8591-c830fac9e067.pem')).toString()
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
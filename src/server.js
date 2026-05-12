const express = require('express')
const cors = require('cors')
require ('dotenv').config()
const pool = require('./db/db')

const petRoutes = require('./routes/petRoutes')

const app =express();

//middleware
app.use(cors({
    origin:[
        'http://localhost:5173',
        'https://7ca53e5e-c8a3-40ba-9e30-38244d911794.e1-eu-west-cdp.choreoapps.dev'
    ]
}));
app.use(express.json());

//routes
app.use('/api', petRoutes);


//test
app.get('/health',(req,res)=>{
    res.json({status:'server is running'})
})

const PORT = process.env.PORT ||3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})


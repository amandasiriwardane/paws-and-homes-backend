const express = require('express')
const router= express.Router()
const axios =require('axios')
const {verifyToken , checkRole} = require('../middleware/authMiddleware')
require('dotenv').config()

router.get('/users',verifyToken, checkRole(['admin']), async (req,res)=>{
    try{
        const tokenParams = new URLSearchParams();
        tokenParams.append('grant_type', 'client_credentials');
        tokenParams.append('scope', 'internal_user_mgt_view');
        
        const tokenResponse = await axios.post(
            `${process.env.ASGARDEO_BASE_URL}/oauth2/token`,
            'grant_type=client_credentials&scope=internal_user_mgt_list',
            {
                headers:{
                    'Content-Type':'application/x-www-form-urlencoded'
                },
                auth:{
                    username:process.env.M2M_CLIENT_ID,
                    password:process.env.M2M_CLIENT_SECRET
                }
            }
        )
        const appToken = tokenResponse.data.access_token

        const result = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Users`,
            {
                headers:{
                    'Authorization': `Bearer ${appToken}`
                }
            }
        )
        res.json(result.data)
    } catch(err) {
    if (err.response) {
        // This prints the exact details (like 'insufficient_scope')
        console.error('Asgardeo Rejection Data:', err.response.data); 
        res.status(500).json({ message: err.message, details: err.response.data });
    } else {
        console.log('Error:', err.message);
        res.status(500).json({ message: err.message });
    }
    }
})

module.exports = router
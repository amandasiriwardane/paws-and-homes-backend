// src/routes/authWebhook.js
const express = require('express');
const router = express.Router();
const axios =require('axios')
require ('dotenv').config()

router.post('/api/auth/pre-issue-token',async(req, res) => {
    try{
        const event = req.body?.event;
        const userId = event?.user?.id;
        const claims = event?.user?.claims ||{};
        
        const customRole = claims["http://wso2.org/claims/userRole"] || claims["userRole"];

        console.log('User ID:', userId)
        console.log('Custom role:', customRole)
        
        if (!customRole || !userId){
            return res.json({actionStatus:"SUCCESS"})
        }

        //M2M token
        const tokenResponse = await axios.post(
            `${process.env.ASGARDEO_BASE_URL}/oauth2/token`,
            'grant_type=client_credentials&scope=internal_user_mgt_update',
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
        const appToken = tokenResponse.data.access_token;

        //get all roles
        const rolesResponse = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles`,
            {
                headers:{
                    'Authorization': `Bearer ${appToken}`
                }
            }
        )

        //find matching role
        const rolesList = rolesResponse.data.Resources ||[];
        const selectedRole =rolesList.find(r=>
            r.displayName?.toLowerCase() === customRole.trim().toLowerCase() 
        )

        if (!selectedRole){
            console.log(`Role ${customRole} not found in Asgardeo`);
            return res.json({actionStatus:"SUCCESS"})
        }

        //check if role already assigned
        const roleDetails = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles/${selectedRole.id}`,
            {
                headers:{
                    'Authorization': `Bearer ${appToken}`
                }
            }
        )

        const alreadyAssigned = roleDetails.data.users?.some(
            u => u.value === userId
        )

        if (alreadyAssigned){
            console.log('Role already assigned. Injecting runtime claim.');
            // Add instructions so it applies to the current session token immediately
            return res.json({
                actionStatus: "SUCCESS",
                operations: [{ op: "add", path: "/accessToken/claims/roles", value: [customRole.toLowerCase()] }]
            })
        }

        //assign role permanently
        await axios.patch(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles/${selectedRole.id}`,
            {
                schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                Operations: [{
                    op:"add",
                    path:"users",
                    value:[{value:userId}]
                }]
            },
            {
                headers:{
                    'Authorization': `Bearer ${appToken}`,
                    'Content-Type':'application/json'
                }
            }
        )

        console.log('Roles assigned permanently!')
        return res.json({
            actionStatus: "SUCCESS",
            operations: [{ op: "add", path: "/accessToken/claims/roles", value: [customRole.toLowerCase()] }]
        });    
    } catch (err){
        console.log('Webhook error', err.message)
        return res.json({actionStatus:"SUCCESS"})
    }
    
    
    
    
    
    /*
    // 1. Asgardeo automatically sends the user's profile claims in req.body
    
    
    
    const claims = req.body?.event?.user?.claims || {};
    
    // 2. Extract the custom registration attribute string
    const selectedRole = claims["wso2.org"] || "adopter";
    const cleanRole = selectedRole.trim().toLowerCase();

    // 3. Respond with instructions telling Asgardeo what to put in the final JWT
    return res.status(200).json({
        actionStatus: "SUCCESS",
        operations: [
            {
                op: "add",
                path: "/accessToken/claims/roles", // Injects into the standard roles array
                value: [cleanRole]
            }
        ]
    });

    */
});

module.exports = router;

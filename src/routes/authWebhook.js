// src/routes/authWebhook.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

router.post('/api/auth/pre-issue-token', async (req, res) => {
    try {
        const event = req.body?.event;
        const userId = event?.user?.id;
        const claims = event?.user?.claims || {};
        
        const customRole = claims["http://wso2.org/claims/userRole"] || claims["userRole"];

        console.log('User ID Profile Context:', userId);
        console.log('Custom onboarding role parsed:', customRole);
        
        // FIX: Provide a valid empty operations array block for existing accounts/Admins
        if (!customRole || !userId) {
            console.log("Existing user context matched. Letting token pass untouched.");
            return res.json({
                actionStatus: "SUCCESS",
                operations: [] 
            });
        }

        // M2M token request
        const tokenResponse = await axios.post(
            `${process.env.ASGARDEO_BASE_URL}/oauth2/token`,
            'grant_type=client_credentials&scope=internal_user_mgt_update',
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                auth: {
                    username: process.env.M2M_CLIENT_ID,
                    password: process.env.M2M_CLIENT_SECRET
                }
            }
        );
        const appToken = tokenResponse.data.access_token;

        // Get all system roles
        const rolesResponse = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles`,
            { headers: { 'Authorization': `Bearer ${appToken}` } }
        );

        // Find matching role row entry
        const rolesList = rolesResponse.data.Resources || [];
        const selectedRole = rolesList.find(r =>
            r.displayName?.toLowerCase() === customRole.trim().toLowerCase() 
        );

        if (!selectedRole) {
            console.log(`Target database group matching [${customRole}] not found inside Asgardeo.`);
            return res.json({
                actionStatus: "SUCCESS",
                operations: [] 
            });
        }

        // Check if role is already mapped
        const roleDetails = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles/${selectedRole.id}`,
            { headers: { 'Authorization': `Bearer ${appToken}` } }
        );

        const alreadyAssigned = roleDetails.data.users?.some(u => u.value === userId);

        if (alreadyAssigned) {
            console.log('User already holds group membership. Injecting active claims array.');
            return res.json({
                actionStatus: "SUCCESS",
                operations: [{ op: "add", path: "/accessToken/claims/roles", value: [customRole.toLowerCase()] }]
            });
        }

        // Assign user permanently to target group
        await axios.patch(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles/${selectedRole.id}`,
            {
                schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
                Operations: [{
                    op: "add",
                    path: "users",
                    value: [{ value: userId }]
                }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${appToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Role permanently linked inside database registry rows!');
        return res.json({
            actionStatus: "SUCCESS",
            operations: [{ op: "add", path: "/accessToken/claims/roles", value: [customRole.toLowerCase()] }]
        });    
    } catch (err) {
        console.error('Webhook mapping routine failure execution logs:', err.response?.data || err.message);
        return res.json({
            actionStatus: "SUCCESS",
            operations: [] 
        });
    }
});

module.exports = router;

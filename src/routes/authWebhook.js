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
        
        // Correctly parse the custom user claim
        const customRole = claims["wso2.org"] || claims["userRole"] || claims["userrole"];

        console.log('User ID Profile Context:', userId);
        console.log('Custom onboarding role parsed:', customRole);
        
        // --- ASGARDEO FIX 1: CLEARING OUT PRE-REGISTERED ACCOUNTS & ADMINS ---
        // If there is no selection string data, we MUST omit the operations field entirely!
        if (!customRole || !userId) {
            console.log("No custom sign-up selection found. Passing token untouched.");
            return res.status(200).json({
                actionStatus: "SUCCESS"
            });
        }

        const cleanRoleValue = customRole.trim().toLowerCase();

        // 1. Get Administrative M2M Token context
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

        // 2. Fetch the roles definitions catalogue matrix
        const rolesResponse = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles`,
            { headers: { 'Authorization': `Bearer ${appToken}` } }
        );

        const rolesList = rolesResponse.data.Resources || [];
        const selectedRole = rolesList.find(r =>
            r.displayName?.toLowerCase() === cleanRoleValue
        );

        if (!selectedRole) {
            console.log(`Target database group matching [${cleanRoleValue}] not found inside Asgardeo.`);
            // Fallback: Still inject the claim string directly into the token structure so frontend routes function
            return res.status(200).json({
                actionStatus: "SUCCESS",
                operations: [
                    {
                        op: "add",
                        path: "/accessToken/claims/roles",
                        value: [cleanRoleValue]
                    }
                ]
            });
        }

        // 3. Check if role is already permanently mapped
        const roleDetails = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles/${selectedRole.id}`,
            { headers: { 'Authorization': `Bearer ${appToken}` } }
        );

        const alreadyAssigned = roleDetails.data.users?.some(u => u.value === userId);

        if (alreadyAssigned) {
            console.log('User already holds group membership. Generating runtime active array claims.');
            // --- ASGARDEO FIX 2: VALID CONTRACT RESPONSE STRUCTURE ---
            return res.status(200).json({
                actionStatus: "SUCCESS",
                operations: [
                    {
                        op: "add",
                        path: "/accessToken/claims/roles",
                        value: [cleanRoleValue]
                    }
                ]
            });
        }

        // 4. Assign user permanently to target security group inside identity registry
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
        return res.status(200).json({
            actionStatus: "SUCCESS",
            operations: [
                {
                    op: "add",
                    path: "/accessToken/claims/roles",
                    value: [cleanRoleValue]
                }
            ]
        });    
    } catch (err) {
        console.error('Webhook mapping routine failure execution logs:', err.response?.data || err.message);
        // Safety Fallback: Ensure login loop never completely crashes on internal code hiccups
        return res.status(200).json({ 
            actionStatus: "SUCCESS" 
        });
    }
});

module.exports = router;

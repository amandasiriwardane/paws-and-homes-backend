// src/routes/authWebhook.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

router.post('/api/auth/pre-issue-token', async (req, res) => {
    try {
        const event = req.body?.event;
        const userId = event?.user?.id;
        const claimsRaw = event?.accessToken?.claims || []; // Asgardeo passes claims as an array of {name, value}
        
        // Find the custom userRole attribute value if it exists inside the array
        const customRoleClaim = claimsRaw.find(c => c.name === "wso2.org" || c.name === "userRole");
        const customRole = customRoleClaim ? customRoleClaim.value : null;

        console.log('User ID Profile Context:', userId);
        console.log('Custom onboarding role parsed:', customRole);
        
        // --- 1. FALLBACK PATH: PRE-REGISTERED ACCOUNTS & ADMINS ---
        if (!customRole || !userId) {
            console.log("No custom sign-up selection found. Sending clean default structure.");
            return res.status(200).json({
                actionStatus: "SUCCESS",
                operations: []
            });
        }

        const cleanRoleValue = customRole.trim().toLowerCase();

        // 2. Fetch administrative M2M token context
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

        // 3. Fetch the system roles catalogue matrix
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
            // Fallback: Inject claim to token according to the contract spec so frontend routes function
            return res.status(200).json({
                actionStatus: "SUCCESS",
                operations: [
                    {
                        op: "add",
                        path: "/accessToken/claims/-",
                        value: {
                            "name": "roles",
                            "value": [cleanRoleValue]
                        }
                    }
                ]
            });
        }

        // 4. Verify existing database assignments to prevent duplicates
        const roleDetails = await axios.get(
            `${process.env.ASGARDEO_BASE_URL}/scim2/Roles/${selectedRole.id}`,
            { headers: { 'Authorization': `Bearer ${appToken}` } }
        );

        const alreadyAssigned = roleDetails.data.users?.some(u => u.value === userId);

        if (alreadyAssigned) {
            console.log('User already holds group membership. Injecting active claims.');
            return res.status(200).json({
                actionStatus: "SUCCESS",
                operations: [
                    {
                        op: "add",
                        path: "/accessToken/claims/-",
                        value: {
                            "name": "roles",
                            "value": [cleanRoleValue]
                        }
                    }
                ]
            });
        }

        // 5. Assign user permanently to target group inside the registry
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
                    path: "/accessToken/claims/-",
                    value: {
                        "name": "roles",
                        "value": [cleanRoleValue]
                    }
                }
            ]
        });    
    } catch (err) {
        console.error('Webhook mapping routine failure execution logs:', err.response?.data || err.message);
        // Safety Fallback: Ensure token endpoint never completely crashes on script hiccups
        return res.status(200).json({ 
            actionStatus: "SUCCESS",
            operations: []
        });
    }
});

module.exports = router;

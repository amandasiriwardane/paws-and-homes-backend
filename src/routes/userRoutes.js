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


router.post('/users/complete-registration', verifyToken, async (req, res) => {
  try {
    const { selectedRole, userId , userName} = req.body;
    console.log("REQ.USER:", req.user);
    console.log("SCIM USER ID FROM FRONTEND:", userId);

    // map role to group ID
    const groupMap = {
      'adopter': process.env.ADOPTER_GROUP_ID,
      'shelter-staff': process.env.SHELTER_STAFF_GROUP_ID
    };

    const groupId = groupMap[selectedRole];

    if (!groupId) {
      return res.status(400).json({ message: 'Invalid role selected' });
    }

    // get M2M token
    const tokenResponse = await axios.post(
      `${process.env.ASGARDEO_BASE_URL}/oauth2/token`,
      'grant_type=client_credentials&scope=internal_group_mgt_update',
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: {
          username: process.env.M2M_CLIENT_ID,
          password: process.env.M2M_CLIENT_SECRET
        }
      }
    );

    const appToken = tokenResponse.data.access_token;

    console.log("Selected Role:", selectedRole);
    console.log("Mapped Group ID:", groupId);
    console.log("User ID being added:", userId);
    // add user to group
    await axios.patch(
      `${process.env.ASGARDEO_BASE_URL}/scim2/Groups/${groupId}`,
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [
        {
            op: "add",
            value: {
            members: [
                {
                display: userName,
                value: userId
                }
            ]
            }
        }
        ]
    },
    {
        headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/scim+json"
        }
      }
    );
    console.log("GROUP PATCH SUCCESS");
    res.json({ message: 'Role assigned successfully!' });

  } catch (err) {

    if (err.response) {
        console.log("ASGARDEO ERROR STATUS:", err.response.status);
        console.log(
        "ASGARDEO ERROR DATA:",
        JSON.stringify(err.response.data, null, 2)
        );
        return res.status(500).json({
        message: err.message,
        details: err.response.data
        });
    } else {
        console.log("SERVER ERROR:", err.message);
         return res.status(500).json({
        message: err.message
        });
    }
    }
});


module.exports = router
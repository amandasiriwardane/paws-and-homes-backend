const jwt= require('jsonwebtoken')
const jwksClient = require('jwks-rsa')
require('dotenv').config()

//connect to asgardeo public keys
const client = jwksClient({
    jwksUri: `${process.env.ASGARDEO_BASE_URL}/oauth2/jwks`
})

//get signin key 
function getKey(header, callback){
    client.getSigningKey(header.kid, (err,key)=>{
        if (err)return callback(err)
            const signingKey =key.getPublicKey();
        callback(null,signingKey)
    })
}

//middleware function to verify token
function verifyToken(req,res,next){
    //get token from header
    const authHeader =req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token){
        return res.status(401).json({message:'No token provided'})
    }


    //verify token
    jwt.verify(token, getKey,{
        algorithms:['RS256'],
            issuer: `${process.env.ASGARDEO_BASE_URL}/oauth2/token`,
            audience: process.env.ASGARDEO_CLIENT_ID
        
    }, (err,decoded)=>{
        if(err){
            console.log("Validation Error:", err.message); 
            return res.status(401).json({message:'Invalid token '})
        }

        req.user = decoded //attach use info to request 
        next() //allow req to contine
    })
}

//verify role
function checkRole(allowedRoles){
    return (req,res,next)=>{
        
        const rolesRaw = req.user?.roles || []
        const roles = Array.isArray(rolesRaw)
            ? rolesRaw
            :[rolesRaw]
        //console.log("user roles", roles)
        //console.log("allowed roles", allowedRoles)

        const hasRole = roles.some(role => allowedRoles.includes(role))

        if (!hasRole){
            return res.status(403).json({
                message:'Forbidden - insufficient role'
            })
        }
        next()
    }

}


module.exports ={ verifyToken, checkRole};
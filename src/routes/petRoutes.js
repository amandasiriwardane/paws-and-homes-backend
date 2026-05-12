const express = require('express')
const router= express.Router()
const {verifyToken , checkRole} = require('../middleware/authMiddleware')
const pool = require('../db/db'); 

router.get('/pets', async (req,res)=>{
    try{
        const result = await pool.query('SELECT* FROM pets')
        res.json(result.rows)
    } catch(err){
        res.status(500).json({message:err.message})
    }
})

//create pet protected -shelter staff
router.post('/pets', verifyToken, checkRole(['shelter-staff']), async (req,res)=>{
    try{
        const {name, species, breed, age, status} = req.body
        const result = await pool.query(
            ' INSERT INTO pets (name, species, breed,age, status,shelter_id) VALUES ( $1, $2, $3, $4, $5,$6) RETURNING *',
            [name, species, breed, age, status, req.user.sub]
        )
        res.status(201).json(result.rows[0])
    } catch(err){
        res.status(500).json({message:err.message})
    }
})

//edit pet protected -shelter staff
router.patch('/pets/:id', verifyToken, checkRole(['shelter-staff']), async (req,res)=>{
    try{
        const pet = await pool.query('SELECT * FROM pets WHERE id=$1',[req.params.id])
        const {name, species, breed, age, status} = req.body
        const result = await pool.query(
            ' UPDATE pets SET name=$1, species=$2, breed=$3,age=$4, status=$5 WHERE id=$6 RETURNING *',
            [name, species, breed, age, status, req.params.id]
        )
        res.status(201).json(result.rows[0])
    } catch(err){
        res.status(500).json({message:err.message})
    }
})

//delete pet protected- shelter staff
router.delete('/pets/:id', verifyToken, checkRole(['shelter-staff']), async (req,res)=>{
    try{
        const pet = await pool.query('SELECT* FROM pets WHERE id = $1', [req.params.id])
        if (pet.rows.length === 0){
            return res.status(404).json({message:'Pet not Found'})
        }
        if (pet.rows[0].shelter_id != req.user.sub){
            return res.status(403).json({message:'You can only delete your pets'})
        }
        await pool.query('DELETE FROM pets WHERE id =$1', [req.params.id])
        res.json({message:'Pet Deleted!'})

    } catch(err){
        res.status(500).json({message:err.message})
    }
})

module.exports =router;

// schema.js
const createTables = async (pool) => { 
    try {
        await pool.query(`
             CREATE TABLE IF NOT EXISTS pets (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                species VARCHAR(50) NOT NULL,
                breed VARCHAR(100),
                age INTEGER,
                shelter_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'Available'
             );
        `);
        console.log('Table created!');
    } catch (err) {
        console.error('Error creating table:', err.message);
    }
};

module.exports = createTables;

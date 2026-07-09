const db = require('./config/db');

async function checkData() {
    try {
        const user = await db.query("SELECT id FROM users WHERE email = 'admin@admin.com'");
        console.log("Admin User:", user.rows);

        const books = await db.query("SELECT id, title FROM books LIMIT 3");
        console.log("Books:", books.rows);

        const categories = await db.query("SELECT id, name FROM categories LIMIT 3");
        console.log("Categories:", categories.rows);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
checkData();

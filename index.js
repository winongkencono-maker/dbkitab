require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initEmbedder } = require('./utils/embedder');

const booksRouter = require('./routes/books');
const authorsRouter = require('./routes/authors');
const categoriesRouter = require('./routes/categories');
const searchRouter = require('./routes/search');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const readerRouter = require('./routes/reader');
const subscriptionsRouter = require('./routes/subscriptions');
const productsRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const ordersRouter = require('./routes/orders');
const communityBooksRouter = require('./routes/community_books');

const adminProductsRouter = require('./routes/admin/products');
const adminOrdersRouter = require('./routes/admin/orders');
const adminShipmentsRouter = require('./routes/admin/shipments');
const adminStatsRouter = require('./routes/admin/stats');

const setupSwagger = require('./swagger');

const app = express();
const port = process.env.PORT || 8081;

app.use(cors());
app.use(express.json());

// Serve static files (covers, uploads)
app.use('/public', express.static('public'));

// Setup Swagger UI
setupSwagger(app);

// Routes
app.use('/api/books', booksRouter);
app.use('/api/authors', authorsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/search', searchRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/reader', readerRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/community-books', communityBooksRouter);

app.use('/api/admin/products', adminProductsRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/shipments', adminShipmentsRouter);
app.use('/api/admin/stats', adminStatsRouter);

app.get('/', (req, res) => {
    res.json({ message: 'Welcome to dbkitab REST API' });
});

// Initialize model and start server
async function startServer() {
    try {
        // Pre-load the AI model so it's ready for the first request
        await initEmbedder();
        
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

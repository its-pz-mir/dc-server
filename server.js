const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const valuationRoutes = require('./routes/valuationRoutes');

const app = express();

// Middleware
app.use(
  express.json({
    verify: (req, res, body) => {
      let end = body.length;
      while (end > 0 && body[end - 1] === 0) {
        end -= 1;
      }
      if (end < body.length) {
        body.fill(0x20, end);
      }
    },
  }),
);
app.use(cors(["http://10.71.89.178:3000", "http://localhost:3000"]));

// MongoDB Connection using your legacy URI string
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes
app.use('/api/v1/valuation', valuationRoutes);

app.use((error, req, res, next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body.' });
  }
  return next(error);
});

// Root health check route
app.get('/', (req, res) => {
  res.json({ status: 'API is running successfully', app: 'Lahore DC Valuation MVP' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
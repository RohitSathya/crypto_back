const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const StockSchema = new mongoose.Schema({
  symbol: String,
  price: Number,
  timestamp: { type: Date, default: Date.now },
});

const Stock = mongoose.model('Stock', StockSchema);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.get('/api/stock/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const data = await Stock.find({ symbol }).sort({ timestamp: -1 }).limit(20);
  res.json(data);
});

app.get('/api/symbols', async (req, res) => {
  const symbols = await Stock.distinct('symbol');
  res.json(symbols);
});

app.post('/api/stock', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) {
    return res.status(400).send('Symbol is required');
  }
  try {
    const response = await axios.post(
      'https://api.livecoinwatch.com/coins/single',
      {
        currency: 'USD',
        code: symbol,
        meta: true,
      },
      {
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.LIVECOINWATCH_API_KEY,
        },
      }
    );

    const price = response.data.rate;
    await Stock.create({ symbol, price });
    res.status(201).send('Data added successfully');
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    res.status(500).send('Internal Server Error');
  }
});

setInterval(async () => {
  const symbols = await Stock.distinct('symbol');
  for (let symbol of symbols) {
    try {
      const response = await axios.post(
        'https://api.livecoinwatch.com/coins/single',
        {
          currency: 'USD',
          code: symbol,
          meta: true,
        },
        {
          headers: {
            'content-type': 'application/json',
            'x-api-key': process.env.LIVECOINWATCH_API_KEY,
          },
        }
      );

      const price = response.data.rate;
      await Stock.create({ symbol, price });
    } catch (error) {
      console.error(`Error fetching data for ${symbol}:`, error);
    }
  }
}, 5000);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));

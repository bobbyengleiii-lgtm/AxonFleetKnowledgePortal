const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint (REQUIRED)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve static docs
app.use(express.static('docs'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

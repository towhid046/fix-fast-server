const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;

// middleware:
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send('FixFast is running...');
});

app.listen(port, () => {
  console.log(`FixFast listening at http://localhost:${port}`);
});

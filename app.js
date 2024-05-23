const express = require('express');
const app = express();
const path = require("path");
const ejs = require("ejs");
const indexRouter = require("./route");
const dotenv = require("dotenv");
const bodyParser = require('body-parser');
const cron = require('node-cron');
const axios = require("axios");
dotenv.config();

const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static('public'));
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true })); 

app.use('/', indexRouter)

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

cron.schedule('*/60 * * * * *', async () => {  // Executa a cada 1 minuto
    try {
        const response = await axios.post(`http://localhost:${PORT}/despesas`, {});
        console.log('POST request successful:', response.data);
    } catch (error) {
        console.error('Error making POST request:', error);
    }
});

cron.schedule('*/600 * * * * *', async () => { // Executa a cada 10 minutos
    try {
        const response = await axios.post(`http://localhost:${PORT}/faturamento`, {});
        console.log('POST request successful:', response.data);
    } catch (error) {
        console.error('Error making POST request:', error);
    }
});
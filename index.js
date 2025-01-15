import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { initNews } from "./news.js"
import { sendQuery, processQuery, addData } from './openai.js';
import { getWeather } from './weather.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
dotenv.config();

app.use(cors());
let allowedOrigins = ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://lukowski.io']
app.use(cors({
  origin: (origin, callback) => {
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1) {
      let message = 'The CORS policy for this application does not allow access from origin', origin;
      return callback(new Error(message ), false);
    }
    return callback(null, true);
  }
}));

app.post('/query', async (req, res) => {
  if (req.body.query) {
    try {
      const response = await sendQuery(req.body.query);
      res.send(response);
      const dbQuestionId = await processQuery(req.body.query);
      if (!dbQuestionId) {
        addData({question: req.body.query, answer: response});
        // const query = await getById(dbQuestionId);
        // res.send(query.data().answer)
        // console.log(query.id, '=>', (query.data()));
      }
    } catch {
       res.status(500).send({ error: 'Internal server error' })
    }
  }
})

app.get('/news', async (req, res) => {
   const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  //  const clientIP = '87.178.45.172'; //germany
  //  const clientIP = '185.61.158.61'; //uk
   try {
     const news = await initNews(clientIP);
    res.send(news)
   } catch (error) {
    res.status(500).send(error)
   }
})

app.get('/weather', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lng; 
  try {
    const weatherData = await getWeather(lat, lon);
    res.send(weatherData);
  } catch (error) {
      console.error(error);
      res.status(500).send('An error occurred');
  }
});

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log(`Portfolio server is running on port ${port}`);
})


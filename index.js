import express from 'express';
import openAI from 'openai';
import cors from 'cors';
import fs from 'fs';
import * as dotenv from 'dotenv';
import scrapPortfolio from './scrapPortfolio.js';


dotenv.config();
const app = express();
const openai = new openAI({
  apiKey: process.env.OPENAI_API_KEY
});

const story = fs.readFileSync('./story.txt', 'utf-8');
scrapPortfolio.scrap();
const portfolio = fs.readFileSync('./portfolio.txt', 'utf-8')

app.use(cors());
let allowedOrigins = ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://lukowski.io']
// allowedOrigins = ['*']
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

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: story + portfolio},
    {
      role: "user",
      content: "Who is Wojtek?",
    },
  ],
});

console.log(completion.choices[0].message);

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log('Hello, openAI');
})


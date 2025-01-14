import express from 'express';
import openAI from 'openai';
import cors from 'cors';
import fs from 'fs';
import * as dotenv from 'dotenv';
import scrapPortfolio from './scrapPortfolio.js';
import db from "./database.js";
import natural from "natural";
import axios from 'axios';
import { stringify } from 'querystring';
// import news from "./news.js"

dotenv.config();
const app = express();
const openai = new openAI({
  apiKey: process.env.OPENAI_API_KEY
});
const tfidf = new natural.TfIdf();
const portfolio = fs.readFileSync('./materials/portfolio.txt', 'utf-8');
const story = fs.readFileSync('./materials/story.txt', 'utf-8');
scrapPortfolio.scrap();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        // console.log('added to db')
        // console.log('existing question', dbQuestionId)
        // const query = await getById(dbQuestionId);
        // res.send(query.data().answer)
        // console.log(query.id, '=>', (query.data()));
      } else {
        // console.log('NOT added to db')
      }
    } catch {
       res.status(500).send({ error: 'Internal server error' })
    }
  }
})

async function sendQuery(query)  {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: story + portfolio},
        {
          role: "user",
          content: query,
        },
      ],
    })
    return completion.choices[0].message.content;
  } catch (error) {
    console.log(error);
  }
};

const addData = async (query) => {
  try {
    await db.collection('openai').add({ question: query.question, answer: query.answer });
  } catch (error) {
    console.error("Error adding document:", error);
  }
};

const getAll = async () => { 
  const queries = db.collection('openai');
  const snapshot = await queries.get();
  let questions = [];
  snapshot.forEach(doc => {
    questions.push({id: doc.id, question: doc.data().question})
  });
  return questions;
}

const getById = async (id) => { 
  const queries = db.collection('openai').doc(id);
  const snapshot = await queries.get();
  return snapshot;
}

const processQuery = async (query) => {
  const dbQuestions = await getAll();

  dbQuestions.forEach( question => {
    question.question = question.question.toLowerCase();
    tfidf.addDocument(question.question);
  })

  const tokenizedQuery = query.toLowerCase().split(' ');

  const queryVector = tokenizedQuery.map ((token) => {
    return {
      term: token,
      tfidf: tfidf.tfidf(token, 0)
    }
  })

  const dataBaseVectors = dbQuestions.map((question, index) => {
    const tokens = question.question.split(' ');
    return tokens.map((token) => ({
      term: token,
      tfidf: tfidf.tfidf(token, index)
    }))
  })

  const similarities = dataBaseVectors.map((dbVector, index) => ({
    questionId: dbQuestions[index].id,
    question: dbQuestions[index].question,
    similarity: cosineSimilarity(dbVector, queryVector)
  }));

  similarities.sort((a,b) => b.similarity - a.similarity);

  // console.log(query, 'similarity', similarities[0].similarity)
  if (similarities[0].similarity > .9) {
    return similarities[0].questionId;
  } else return null;
}

const cosineSimilarity = (vec1, vec2) => {
  const dotProduct = vec1.reduce((sum, { term, tfidf }) => {
    const match = vec2.find((v) => v.term === term);
    return sum + (match ? tfidf * match.tfidf : 0);
  }, 0);

  const magnitude1 = Math.sqrt(vec1.reduce((sum, { tfidf }) => sum + tfidf ** 2, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, { tfidf }) => sum + tfidf ** 2, 0));

  return dotProduct / (magnitude1 * magnitude2);
};


  app.get('/news', async (req, res) => {

    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    // const clientIP = '87.178.45.172'; //germany
    // const clientIP = '89.178.45.172'; //russia
    // const clientIP = '185.61.158.61'; //uk
    // const clientIP = '91.239.6.243'; //albania

    console.log(clientIP);
    let ipData;

    if (clientIP) {

      try {
        ipData = await getClientCountry(clientIP);
        console.log(ipData);
        res.send({ 
          clientIP, 
          country: ipData.country,
          countryCode: ipData.countryCode,
          city: ipData.city
        })

        if (clientIP && ipData.country && ipData.countryCode && ipData.city) {
          saveIpData(clientIP, ipData);
        }

      } catch (error) {
        res(500).send('Error')
        console.log(error);
      }

      let clientCountryCode;

      if (ipData.countryCode) {
        clientCountryCode = ipData.countryCode.toLowerCase();
      } else {
        clientCountryCode = 'de';
      }
    } else {
      clientCountryCode = 'de';
    }

    //   try {
    //     const response = await axios.get("https://newsdata.io/api/1/latest", {
    //       params: {
    //         apikey: NEWS_API_KEY,
    //         category: 'politics',
    //         country: clientCountryCode
    //       }
    //     });

    //     console.log(response.data.results.map(news => news.title));
    //     res.send(response.data);
    //   } catch {
    //     res.status(500).send({ error: 'News error' })
    // }
  })

  const saveIpData = async (ip, ipData) => {
    try {
      await db.collection('ip').add({ ip: ip, country: ipData.country, countryCode: ipData.countryCode,  city: ipData.city});
    } catch (error) {
      console.error("Error adding ip:", error);
    }
  };

  const getClientCountry = async (clientIP) => {
    try {
      const response = await axios.get(`http://ip-api.com/json/${clientIP}`);

      console.log(response.data)
      const { country, countryCode, city } = response.data;
      return { country, countryCode, city }
    } catch (error) {
      console.error(error);
      return null;
    }
  }

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log('Hello, openAI');
})


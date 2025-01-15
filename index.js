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
import { error } from 'console';
import {initiateNews} from "./news.js"

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
    await db.collection('openai').add({
      question: query.question, 
      answer: query.answer
    });
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
  //  const clientIP = '87.178.45.172'; //germany
  //  const clientIP = '89.178.45.172'; //russia
  //  const clientIP = '185.61.158.61'; //uk
  //  const clientIP = '91.239.6.243'; //albania
   try {
     const news = await initiateNews(clientIP);
    res.send(news)
   } catch (error) {
    res.status(500).send(error)
   }
})

const port = process.env.PORT || 8080;
app.listen(port, '0.0.0.0', () => {
  console.log('Hello, openAI');
})


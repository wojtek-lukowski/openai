import openAI from 'openai';
import fs from 'fs';
import * as dotenv from 'dotenv';
import scrapPortfolio from './scrapPortfolio.js';
import db from "./database.js";
import natural from "natural";

const openai = new openAI({
  apiKey: process.env.OPENAI_API_KEY
});
const tfidf = new natural.TfIdf();
const portfolio = fs.readFileSync('./materials/portfolio.txt', 'utf-8');
const story = fs.readFileSync('./materials/story.txt', 'utf-8');
scrapPortfolio.scrap();

export const sendQuery = async (query) => {
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

export const addData = async (query) => {
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

// const getById = async (id) => { 
//   const queries = db.collection('openai').doc(id);
//   const snapshot = await queries.get();
//   return snapshot;
// }

export const processQuery = async (query) => {
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
import * as dotenv from 'dotenv';
import db from "./database.js";
import axios from 'axios';

dotenv.config();

export const initiateNews = async (clientIP) => {
  let ipData;
  try {
      if (clientIP) {
      ipData = await getClientCountry(clientIP);
     }
      if (clientIP && ipData.country && ipData.countryCode && ipData.city) {
        saveIpData(clientIP, ipData);
      }
      return await getNews(ipData.countryCode?.toLowerCase() || 'de');
    } catch (error) {
      return null;
    }
}

const getNews = async (countryCode) => {
    try {
      const response = await axios.get("https://newsdata.io/api/1/latest", {
        params: {
          apikey: process.env.NEWS_API_KEY,
          category: 'politics',
          country: countryCode
        }
      });
      return response.data.results.map(({ article_id, title, link }) => ({article_id, title, link}))
    } catch (error) {
      return null;
  }
}

const saveIpData = async (ip, ipData) => {
  const isIpNew = await checkIp(ip);
  if (isIpNew) {
    try {
      await db.collection('ip').add({
        ip: ip, 
        country: ipData.country, 
        countryCode: ipData.countryCode,  
        city: ipData.city,
        proxy: ipData.proxy, 
        date: new Date()
      });
    } catch (error) {
      console.error("Error adding ip:", error);
    }
  }
};

const checkIp = async (clientIP) => { 
  const queries = db.collection('ip');
  const snapshot = await queries.get();
  let allIps = [];
  snapshot.forEach(entry => {
    allIps.push(entry.data().ip)
  });
  const isIpNew = !allIps.includes(clientIP)
  return isIpNew;
}

const getClientCountry = async (clientIP) => {
  try {
    const response = await axios.get(`http://ip-api.com/json/${clientIP}?fields=188639`);

    const { country, countryCode, city, proxy } = response.data;
    return { country, countryCode, city, proxy }
  } catch (error) {
    console.error(error);
    return null;
  }
}

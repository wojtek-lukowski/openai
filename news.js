import axios from 'axios';
import { getClientCountry, saveIpData } from './ip.js';

export const initNews = async (clientIP) => {
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
      return [];
  }
}



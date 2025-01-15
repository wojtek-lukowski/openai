import db from "./database.js";
import axios from 'axios';

export const saveIpData = async (ip, ipData) => {
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

export const getClientCountry = async (clientIP) => {
  try {
    const response = await axios.get(`http://ip-api.com/json/${clientIP}?fields=188639`);

    const { country, countryCode, city, proxy } = response.data;
    return { country, countryCode, city, proxy }
  } catch (error) {
    console.error(error);
    return null;
  }
}

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


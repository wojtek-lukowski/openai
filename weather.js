import db from "./database.js";
import axios from 'axios';

export const getWeather = async (lat, lon) => {
  try {
    const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: {
        lat,
        lon,
        appid: process.env.OPEN_WEATHER_API_KEY
      }
    })
    const weatherData = {
      city: response.data.name,
      country: response.data.sys.country,
      temperature: (response.data.main.temp - 273.15).toFixed(1),
      sky: response.data.weather[0].main
    }
    saveWeather(lat, lon, weatherData);
    return weatherData;
  } catch (error) {
      return null;
  }
}

const saveWeather = async (lat, lon, weatherData) => {
    try {
      await db.collection('weather').add({
        latitude: lat,
        longittude: lon,
        city: weatherData.city,
        country: weatherData.country,
        temperature: `${weatherData.temperature} C°`,
        sky: weatherData.sky,
        date: new Date()
      });
    } catch (error) {
      console.error("Error adding weather:", error);
    }
};


import axios from 'axios';
import fs from 'fs';
import * as cheerio from 'cheerio';

async function scrap() {

try {
  const {data} = await axios.get('https://lukowski.io');
  const $ = cheerio.load(data);
  const content = $('body').text().trim();
  fs.writeFileSync('./portfolio.txt', content, 'utf-8');

} catch (error) {
  console.log(error)
}

}

export default {scrap};

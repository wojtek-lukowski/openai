import axios from 'axios';
import fs from 'fs';
import * as cheerio from 'cheerio';

async function scrap() {

try {
  const {data} = await axios.get('https://lukowski.io');
  const $ = cheerio.load(data);
  const content = $('body').text().replace(/^\s*[\r\n]/gm, '').replace(/\s+/g, ' ').trim().replace(/\n{2,}/g, '\n');
  
  fs.writeFileSync('./materials/portfolio.txt', content, 'utf-8');
} catch (error) {
  console.log(error)
}

}

export default {scrap};

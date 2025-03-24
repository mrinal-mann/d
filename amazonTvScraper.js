const puppeteer = require("puppeteer");
const UserAgent = require("user-agents");
const fs = require("fs").promises;
const moment = require("moment");
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

class AmazonTVScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async setup() {
    try {
      const userAgent = new UserAgent();
      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--window-size=1920,1080",
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
      });
      this.page = await this.browser.newPage();
      await this.page.setUserAgent(userAgent.toString());

      // Set longer timeout for navigation
      this.page.setDefaultNavigationTimeout(60000);

      // Block unnecessary resources to speed up loading
      await this.page.setRequestInterception(true);
      this.page.on("request", (request) => {
        if (["image", "stylesheet", "font"].includes(request.resourceType())) {
          request.abort();
        } else {
          request.continue();
        }
      });
    } catch (error) {
      console.error("Error during setup:", error);
      throw error;
    }
  }

  async getPageContent(url) {
    try {
      // Navigate to the page
      await this.page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Use setTimeout instead of waitForTimeout
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Scroll to load dynamic content
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      return true;
    } catch (error) {
      console.error("Error loading page:", error);
      return false;
    }
  }

  async extractProductName() {
    try {
      const productName = await this.page.$eval("#productTitle", (el) =>
        el.textContent.trim()
      );
      return productName;
    } catch {
      return null;
    }
  }

  async extractRating() {
    try {
      const rating = await this.page.$eval(".a-icon-alt", (el) => {
        return parseFloat(el.textContent.split(" ")[0]);
      });
      return rating;
    } catch {
      return null;
    }
  }

  async extractNumRatings() {
    try {
      const numRatings = await this.page.$eval(
        "#acrCustomerReviewText",
        (el) => {
          return parseInt(el.textContent.replace(/[^0-9]/g, ""));
        }
      );
      return numRatings;
    } catch {
      return null;
    }
  }

  async extractPrice() {
    try {
      const price = await this.page.$eval(".a-price-whole", (el) => {
        return parseFloat(el.textContent.replace(/,/g, ""));
      });
      return price;
    } catch {
      return null;
    }
  }

  async extractDiscount() {
    try {
      const discount = await this.page.$eval(".savingsPercentage", (el) =>
        el.textContent.trim()
      );
      return discount;
    } catch {
      return null;
    }
  }

  async extractBankOffers() {
    try {
      const offers = await this.page.$$eval('div[id^="offer_"]', (elements) => {
        return elements.map((el) => el.textContent.trim());
      });
      return offers;
    } catch {
      return [];
    }
  }

  async extractAboutItem() {
    try {
      const aboutItems = await this.page.$$eval(
        "#feature-bullets li",
        (elements) => {
          return elements.map((el) => el.textContent.trim());
        }
      );
      return aboutItems;
    } catch {
      return [];
    }
  }

  async extractProductInfo() {
    try {
      const info = await this.page.$$eval(
        "#productDetails_techSpec_section_1 tr",
        (rows) => {
          const details = {};
          rows.forEach((row) => {
            const key = row.querySelector("th").textContent.trim();
            const value = row.querySelector("td").textContent.trim();
            details[key] = value;
          });
          return details;
        }
      );
      return info;
    } catch {
      return {};
    }
  }

  async extractProductImages() {
    try {
      const images = await this.page.evaluate(() => {
        const imgUrls = new Set();
        const scripts = document.querySelectorAll(
          'script[type="text/javascript"]'
        );
        scripts.forEach((script) => {
          if (script.textContent.includes("ImageBlockATF")) {
            const matches = script.textContent.match(
              /https:\/\/[^"']*\.(?:jpg|jpeg|png|gif)/g
            );
            if (matches) {
              matches.forEach((url) => imgUrls.add(url));
            }
          }
        });
        return Array.from(imgUrls);
      });
      return images;
    } catch {
      return [];
    }
  }

  async extractManufacturerImages() {
    try {
      const images = await this.page.$$eval("#aplus img", (imgs) => {
        return imgs.map((img) => img.src).filter((src) => src);
      });
      return [...new Set(images)];
    } catch {
      return [];
    }
  }

  async extractAiReviewSummary() {
    try {
      const summary = await this.page.$eval(
        "#cr-summarization-attributes",
        (el) => el.textContent.trim()
      );
      return summary;
    } catch {
      return null;
    }
  }

  async scrapeTvProduct(url) {
    try {
      const success = await this.getPageContent(url);
      if (!success) return null;

      const productData = {
        product_name: await this.extractProductName(),
        rating: await this.extractRating(),
        num_ratings: await this.extractNumRatings(),
        selling_price: await this.extractPrice(),
        discount: await this.extractDiscount(),
        bank_offers: await this.extractBankOffers(),
        about_item: await this.extractAboutItem(),
        product_info: await this.extractProductInfo(),
        product_images: await this.extractProductImages(),
        manufacturer_images: await this.extractManufacturerImages(),
        ai_review_summary: await this.extractAiReviewSummary(),
        scrape_timestamp: moment().format(),
        source_url: url,
      };

      return productData;
    } catch (error) {
      console.error("Error during scraping:", error);
      return null;
    }
  }

  async saveToJson(data, filename = null) {
    try {
      if (!filename) {
        filename = `tv_product_${moment().format("YYYYMMDD_HHmmss")}.json`;
      }

      await fs.writeFile(filename, JSON.stringify(data, null, 4), "utf8");
      return filename;
    } catch (error) {
      console.error("Error saving to JSON:", error);
      return null;
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      console.error("Error closing browser:", error);
    }
  }
}

// Add this new function to handle web requests
async function handleScrapeRequest(url) {
  const scraper = new AmazonTVScraper();
  try {
    await scraper.setup();
    const data = await scraper.scrapeTvProduct(url);
    if (data) {
      const filename = `tv_product_${moment().format("YYYYMMDD_HHmmss")}.json`;
      await scraper.saveToJson(data, filename);
      return { success: true, data, filename };
    }
    return { success: false, error: "Failed to scrape product data" };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await scraper.close();
  }
}

// Add Express routes
app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Amazon TV Scraper</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .form-group { margin-bottom: 15px; }
          input[type="text"] { width: 100%; padding: 8px; margin-top: 5px; }
          button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
          button:hover { background: #0056b3; }
          #result { margin-top: 20px; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <h1>Amazon TV Scraper</h1>
        <div class="form-group">
          <label for="url">Enter Amazon India Smart TV product URL:</label>
          <input type="text" id="url" placeholder="https://www.amazon.in/...">
        </div>
        <button onclick="scrapeProduct()">Scrape Product</button>
        <div id="result"></div>

        <script>
          async function scrapeProduct() {
            const url = document.getElementById('url').value;
            if (!url) {
              alert('Please enter a URL');
              return;
            }
            
            const result = document.getElementById('result');
            result.textContent = 'Scraping in progress...';
            
            try {
              const response = await fetch('/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
              });
              
              const data = await response.json();
              result.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
              result.textContent = 'Error: ' + error.message;
            }
          }
        </script>
      </body>
    </html>
  `);
});

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  try {
    const result = await handleScrapeRequest(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const puppeteer = require("puppeteer");
const UserAgent = require("user-agents");
const fs = require("fs").promises;
const moment = require("moment");
const readline = require("readline");

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

async function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const url = await getUserInput("Enter Amazon India Smart TV product URL: ");

  const scraper = new AmazonTVScraper();
  try {
    await scraper.setup();
    console.log("Scraping product data...");

    const productData = await scraper.scrapeTvProduct(url);
    if (productData) {
      const filename = await scraper.saveToJson(productData);
      if (filename) {
        console.log(`\nProduct data successfully saved to ${filename}`);
      } else {
        console.log("\nFailed to save product data");
      }
    } else {
      console.log("\nFailed to scrape product data");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

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
          "--single-process",
          "--no-zygote",
          "--disable-extensions",
          "--disable-software-rasterizer",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-extensions-with-background-pages",
          "--disable-features=TranslateUI,BlinkGenPropertyTrees",
          "--disable-ipc-flooding-protection",
          "--enable-features=NetworkService,NetworkServiceInProcess",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
          "--password-store=basic",
          "--use-mock-keychain",
          "--use-gl=swiftshader",
          "--window-size=1920,1080",
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
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
        const resourceType = request.resourceType();
        // Only block fonts and unnecessary images
        if (
          resourceType === "font" ||
          (resourceType === "image" && !request.url().includes("amazon.in"))
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Add additional headers to look more like a real browser
      await this.page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
      });
    } catch (error) {
      console.error("Error during setup:", error);
      throw error;
    }
  }

  async getPageContent(url) {
    try {
      // Navigate to the page with a longer timeout
      await this.page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 90000,
      });

      // Wait for key elements to be present
      await this.page
        .waitForSelector("#productTitle", { timeout: 30000 })
        .catch(() => console.log("Timeout waiting for product title"));

      // Scroll to load dynamic content
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return new Promise((resolve) => setTimeout(resolve, 3000));
      });

      // Additional wait for dynamic content
      await this.page.waitForTimeout(2000);

      // Check for captcha or security check
      const pageContent = await this.page.content();
      if (
        pageContent.includes("captcha") ||
        pageContent.includes("security check")
      ) {
        console.log("Detected security check or captcha");
        return false;
      }

      // Log the page content for debugging
      console.log("Page loaded successfully");
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
      console.log("Found product name:", productName);
      return productName;
    } catch (error) {
      console.log("Error extracting product name:", error);
      try {
        const productName = await this.page.$eval(
          ".a-size-large.product-title-word-break",
          (el) => el.textContent.trim()
        );
        console.log("Found product name (alternative):", productName);
        return productName;
      } catch {
        return null;
      }
    }
  }

  async extractRating() {
    try {
      const rating = await this.page.$eval(".a-icon-alt", (el) => {
        return parseFloat(el.textContent.split(" ")[0]);
      });
      return rating;
    } catch {
      try {
        // Try alternative selectors
        const rating = await this.page.$eval(
          ".a-size-base.a-color-base",
          (el) => {
            return parseFloat(el.textContent);
          }
        );
        return rating;
      } catch {
        return null;
      }
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
      try {
        // Try alternative selectors
        const numRatings = await this.page.$eval(
          ".a-size-base.a-color-secondary",
          (el) => {
            return parseInt(el.textContent.replace(/[^0-9]/g, ""));
          }
        );
        return numRatings;
      } catch {
        return null;
      }
    }
  }

  async extractPrice() {
    try {
      const price = await this.page.$eval(".a-price-whole", (el) => {
        return parseFloat(el.textContent.replace(/,/g, ""));
      });
      console.log("Found price:", price);
      return price;
    } catch (error) {
      console.log("Error extracting price:", error);
      try {
        const price = await this.page.$eval(".a-price .a-offscreen", (el) => {
          return parseFloat(el.textContent.replace(/[^0-9.]/g, ""));
        });
        console.log("Found price (alternative):", price);
        return price;
      } catch {
        return null;
      }
    }
  }

  async extractDiscount() {
    try {
      const discount = await this.page.$eval(".savingsPercentage", (el) =>
        el.textContent.trim()
      );
      return discount;
    } catch {
      try {
        // Try alternative selectors
        const discount = await this.page.$eval(".a-color-price", (el) => {
          const text = el.textContent;
          if (text.includes("%")) {
            return text.trim();
          }
          return null;
        });
        return discount;
      } catch {
        return null;
      }
    }
  }

  async extractBankOffers() {
    try {
      const offers = await this.page.$$eval(
        'div[id^="offer_"], .a-section.a-spacing-none.a-spacing-top-micro',
        (elements) => {
          return elements
            .map((el) => el.textContent.trim())
            .filter((text) => text.length > 0);
        }
      );
      return offers;
    } catch {
      return [];
    }
  }

  async extractAboutItem() {
    try {
      const aboutItems = await this.page.$$eval(
        "#feature-bullets li, #productOverview_feature_div li",
        (elements) => {
          return elements
            .map((el) => el.textContent.trim())
            .filter((text) => text.length > 0);
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
        "#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr",
        (rows) => {
          const details = {};
          rows.forEach((row) => {
            const key = row.querySelector("th")?.textContent.trim();
            const value = row.querySelector("td")?.textContent.trim();
            if (key && value) {
              details[key] = value;
            }
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
      const images = await this.page.$$eval(
        "#aplus img, #landingImage",
        (imgs) => {
          return imgs.map((img) => img.src).filter((src) => src);
        }
      );
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
      console.log("Starting to scrape URL:", url);
      const success = await this.getPageContent(url);
      if (!success) {
        console.log("Failed to load page content");
        return null;
      }

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

      console.log("Scraped data:", productData);
      return productData;
    } catch (error) {
      console.error("Error during scraping:", error);
      return null;
    }
  }

  async saveToJson(data, filename) {
    try {
      await fs.writeFile(filename, JSON.stringify(data, null, 2));
      return filename;
    } catch (error) {
      console.error("Error saving to JSON:", error);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
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
          button:disabled { background: #cccccc; cursor: not-allowed; }
          #result { margin-top: 20px; white-space: pre-wrap; }
          .error { color: red; }
          .success { color: green; }
          .loading { color: #007bff; }
          .data-section { margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .data-section h3 { margin-top: 0; }
          .data-item { margin: 10px 0; }
          .data-label { font-weight: bold; }
          .data-value { margin-left: 10px; }
        </style>
      </head>
      <body>
        <h1>Amazon TV Scraper</h1>
        <div class="form-group">
          <label for="url">Enter Amazon India Smart TV product URL:</label>
          <input type="text" id="url" placeholder="https://www.amazon.in/...">
        </div>
        <button id="scrapeButton" onclick="scrapeProduct()">Scrape Product</button>
        <div id="result"></div>

        <script>
          async function scrapeProduct() {
            const url = document.getElementById('url').value;
            const button = document.getElementById('scrapeButton');
            const result = document.getElementById('result');
            
            if (!url) {
              alert('Please enter a URL');
              return;
            }
            
            // Disable button and show loading state
            button.disabled = true;
            result.innerHTML = '<div class="loading">Scraping in progress... This may take a few minutes.</div>';
            
            try {
              const response = await fetch('/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
              });
              
              const data = await response.json();
              if (data.success) {
                result.innerHTML = '<div class="success">Scraping successful!</div>';
                
                // Format and display the data in sections
                const formattedData = formatData(data.data);
                result.innerHTML += formattedData;
              } else {
                result.innerHTML = '<div class="error">Error: ' + data.error + '</div>';
              }
            } catch (error) {
              result.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
            } finally {
              button.disabled = false;
            }
          }

          function formatData(data) {
            let html = '';
            
            // Basic Info Section
            html += '<div class="data-section">';
            html += '<h3>Basic Information</h3>';
            if (data.product_name) html += '<div class="data-item"><span class="data-label">Product Name:</span> <span class="data-value">' + data.product_name + '</span></div>';
            if (data.selling_price) html += '<div class="data-item"><span class="data-label">Price:</span> <span class="data-value">₹' + data.selling_price + '</span></div>';
            if (data.discount) html += '<div class="data-item"><span class="data-label">Discount:</span> <span class="data-value">' + data.discount + '</span></div>';
            html += '</div>';

            // Ratings Section
            html += '<div class="data-section">';
            html += '<h3>Ratings</h3>';
            if (data.rating) html += '<div class="data-item"><span class="data-label">Rating:</span> <span class="data-value">' + data.rating + ' stars</span></div>';
            if (data.num_ratings) html += '<div class="data-item"><span class="data-label">Number of Ratings:</span> <span class="data-value">' + data.num_ratings + '</span></div>';
            if (data.ai_review_summary) html += '<div class="data-item"><span class="data-label">AI Review Summary:</span> <span class="data-value">' + data.ai_review_summary + '</span></div>';
            html += '</div>';

            // Bank Offers Section
            if (data.bank_offers && data.bank_offers.length > 0) {
              html += '<div class="data-section">';
              html += '<h3>Bank Offers</h3>';
              data.bank_offers.forEach(offer => {
                html += '<div class="data-item">' + offer + '</div>';
              });
              html += '</div>';
            }

            // Product Info Section
            if (Object.keys(data.product_info).length > 0) {
              html += '<div class="data-section">';
              html += '<h3>Product Information</h3>';
              for (const [key, value] of Object.entries(data.product_info)) {
                html += '<div class="data-item"><span class="data-label">' + key + ':</span> <span class="data-value">' + value + '</span></div>';
              }
              html += '</div>';
            }

            // About Item Section
            if (data.about_item && data.about_item.length > 0) {
              html += '<div class="data-section">';
              html += '<h3>About Item</h3>';
              data.about_item.forEach(item => {
                html += '<div class="data-item">' + item + '</div>';
              });
              html += '</div>';
            }

            // Images Section
            if (data.product_images && data.product_images.length > 0) {
              html += '<div class="data-section">';
              html += '<h3>Product Images</h3>';
              data.product_images.forEach(image => {
                html += '<div class="data-item"><img src="' + image + '" style="max-width: 200px; margin: 10px 0;"></div>';
              });
              html += '</div>';
            }

            return html;
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

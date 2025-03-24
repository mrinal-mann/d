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
      this.browser = await puppeteer.launch({
        headless: false, // Changed to false to show browser window
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
      await this.setupPage(this.page);
    } catch (error) {
      console.error("Error during setup:", error);
      throw error;
    }
  }

  async setupPage(page) {
    const userAgent = new UserAgent();
    await page.setUserAgent(userAgent.toString());

    // Add more realistic browser behavior
    await page.evaluateOnNewDocument(() => {
      // Overwrite navigator properties
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Add more realistic navigator properties
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      Object.defineProperty(navigator, "plugins", {
        get: () => [
          {
            0: { type: "application/x-google-chrome-pdf" },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin",
          },
        ],
      });

      // Add screen properties
      Object.defineProperty(screen, "colorDepth", {
        get: () => 24,
      });

      Object.defineProperty(screen, "pixelDepth", {
        get: () => 24,
      });

      // Add more realistic browser properties
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => 8,
      });

      Object.defineProperty(navigator, "deviceMemory", {
        get: () => 8,
      });

      Object.defineProperty(navigator, "maxTouchPoints", {
        get: () => 0,
      });

      // Add WebGL properties
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) {
          return "Intel Open Source Technology Center";
        }
        if (parameter === 37446) {
          return "Mesa DRI Intel(R) HD Graphics (SKL GT2)";
        }
        return getParameter.apply(this, arguments);
      };
    });

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      const url = request.url();

      // Allow essential resources
      if (
        url.includes("amazon.in") ||
        resourceType === "document" ||
        resourceType === "xhr" ||
        resourceType === "fetch" ||
        resourceType === "script" ||
        resourceType === "stylesheet"
      ) {
        request.continue();
      } else {
        request.abort();
      }
    });

    // Add more realistic headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Cache-Control": "max-age=0",
      "sec-ch-ua":
        '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "sec-ch-prefers-color-scheme": "light",
      "sec-ch-viewport-width": "1920",
      "sec-ch-device-memory": "8",
      "sec-ch-dpr": "1",
      "sec-ch-ua-arch": '"x86"',
      "sec-ch-ua-bitness": '"64"',
      "sec-ch-ua-full-version": '"121.0.0.0"',
      "sec-ch-ua-full-version-list":
        '"Not A(Brand";v="99.0.0.0", "Google Chrome";v="121.0.0.0", "Chromium";v="121.0.0.0"',
      "sec-ch-ua-model": '""',
      "sec-ch-ua-platform-version": '"10.0.0"',
      "sec-ch-ua-wow64": "?0",
    });

    // Add cookies handling with more realistic values
    await page.setCookie({
      name: "session-token",
      value: "test-token",
      domain: ".amazon.in",
      path: "/",
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });

    // Add more realistic viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });

    // Add random mouse movements and scrolling
    await page.evaluateOnNewDocument(() => {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });

    // Add random delays between actions
    await page.evaluateOnNewDocument(() => {
      const originalSetTimeout = window.setTimeout;
      window.setTimeout = function (callback, delay) {
        const randomDelay = delay + Math.random() * 1000;
        return originalSetTimeout(callback, randomDelay);
      };
    });
  }

  async getPageContent(url) {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1} to load page`);
        console.log("URL being accessed:", url);

        // Create a new page for each attempt
        if (this.page) {
          try {
            await this.page.close();
            console.log("Successfully closed previous page");
          } catch (e) {
            console.log("Error closing previous page:", e.message);
          }
        }

        this.page = await this.browser.newPage();
        console.log("Created new page");
        await this.setupPage(this.page);
        console.log("Page setup completed");

        // Set a longer timeout for navigation
        await this.page.setDefaultNavigationTimeout(120000); // 2 minutes
        console.log("Set navigation timeout to 2 minutes");

        // Add random delay before navigation
        const delay = Math.random() * 3000;
        console.log(`Waiting ${delay.toFixed(2)}ms before navigation`);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Navigate to the page with a longer timeout and wait for network to be idle
        console.log("Starting page navigation...");
        await this.page.goto(url, {
          waitUntil: ["networkidle0", "domcontentloaded"],
          timeout: 120000,
        });
        console.log("Page navigation completed");

        // Add random delay after navigation
        const postDelay = Math.random() * 2000;
        console.log(`Waiting ${postDelay.toFixed(2)}ms after navigation`);
        await new Promise((resolve) => setTimeout(resolve, postDelay));

        // Check for captcha or security check
        const pageContent = await this.page.content();
        if (
          pageContent.includes("captcha") ||
          pageContent.includes("security check") ||
          pageContent.includes("Enter the characters you see below")
        ) {
          console.log("Captcha or security check detected!");
          console.log(
            "Please solve the captcha manually in the browser window."
          );

          // Wait for user to solve captcha
          await new Promise((resolve) => {
            const checkCaptcha = async () => {
              const currentContent = await this.page.content();
              if (
                !currentContent.includes("captcha") &&
                !currentContent.includes("security check") &&
                !currentContent.includes("Enter the characters you see below")
              ) {
                console.log("Captcha solved! Continuing...");
                resolve();
              } else {
                setTimeout(checkCaptcha, 5000); // Check every 5 seconds
              }
            };
            checkCaptcha();
          });
        }

        // Wait for any of the key elements to be present
        const keySelectors = [
          "#productTitle",
          ".a-price-whole",
          "#title",
          ".a-size-large.product-title-word-break",
        ];

        let foundKeyElement = false;
        for (const selector of keySelectors) {
          try {
            console.log(`Waiting for selector: ${selector}`);
            await this.page.waitForSelector(selector, { timeout: 10000 });
            console.log(`Found key element: ${selector}`);
            foundKeyElement = true;
            break;
          } catch (e) {
            console.log(`Selector ${selector} not found: ${e.message}`);
          }
        }

        if (!foundKeyElement) {
          console.log("WARNING: No key elements found on the page");
        }

        // Log the page content for debugging
        console.log("Page loaded successfully");
        return true;
      } catch (error) {
        console.error(
          `Attempt ${retryCount + 1} failed with error:`,
          error.message
        );
        console.error("Full error details:", error);

        // Check if it's a frame detachment error
        if (
          error.message.includes("detached Frame") ||
          error.message.includes("Frame was detached")
        ) {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log("Retrying after frame detachment...");
            // Wait a bit before retrying
            await new Promise((resolve) => setTimeout(resolve, 10000));
            continue;
          }
        }

        // If it's not a frame detachment error or we've exhausted retries
        throw error;
      }
    }

    throw new Error("Failed to load page after multiple attempts");
  }

  async extractProductName() {
    try {
      // Try multiple selectors for product name
      const selectors = [
        "#productTitle",
        ".a-size-large.product-title-word-break",
        "#title",
        ".a-size-large.a-spacing-none",
        ".a-size-large.a-spacing-none.a-spacing-top-micro",
      ];

      for (const selector of selectors) {
        try {
          const productName = await this.page.$eval(selector, (el) =>
            el.textContent.trim()
          );
          if (productName) {
            console.log("Found product name:", productName);
            return productName;
          }
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      return null;
    } catch (error) {
      console.log("Error extracting product name:", error);
      return null;
    }
  }

  async extractRating() {
    try {
      // Try multiple selectors for rating
      const selectors = [
        ".a-icon-alt",
        ".a-size-base.a-color-base",
        "#acrPopover",
        ".a-size-medium.a-color-base",
        ".a-icon-star-small",
      ];

      for (const selector of selectors) {
        try {
          const rating = await this.page.$eval(selector, (el) => {
            const text = el.textContent;
            const matches = text.match(/\d+\.?\d*/);
            return matches ? parseFloat(matches[0]) : null;
          });
          if (rating) {
            console.log("Found rating:", rating);
            return rating;
          }
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      return null;
    } catch (error) {
      console.log("Error extracting rating:", error);
      return null;
    }
  }

  async extractNumRatings() {
    try {
      // Try multiple selectors for number of ratings
      const selectors = [
        "#acrCustomerReviewText",
        ".a-size-base.a-color-secondary",
        "#acrCustomerReviewLink",
        ".a-size-base.a-link-normal",
      ];

      for (const selector of selectors) {
        try {
          const numRatings = await this.page.$eval(selector, (el) => {
            const text = el.textContent;
            const matches = text.match(/\d+/);
            return matches ? parseInt(matches[0]) : null;
          });
          if (numRatings) {
            console.log("Found number of ratings:", numRatings);
            return numRatings;
          }
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      return null;
    } catch (error) {
      console.log("Error extracting number of ratings:", error);
      return null;
    }
  }

  async extractPrice() {
    try {
      // Try multiple selectors for price
      const selectors = [
        ".a-price-whole",
        ".a-price .a-offscreen",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".a-price .a-text-price",
        ".a-price[data-a-color='price']",
        "#price_inside_buybox",
      ];

      for (const selector of selectors) {
        try {
          const price = await this.page.$eval(selector, (el) => {
            const text = el.textContent;
            const matches = text.match(/[\d,]+\.?\d*/);
            return matches ? parseFloat(matches[0].replace(/,/g, "")) : null;
          });
          if (price) {
            console.log("Found price:", price);
            return price;
          }
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      return null;
    } catch (error) {
      console.log("Error extracting price:", error);
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
      // Try multiple selectors for about item
      const selectors = [
        "#feature-bullets li",
        "#productOverview_feature_div li",
        ".a-section.a-spacing-medium.a-spacing-top-small li",
        ".a-section.a-spacing-none.a-spacing-top-micro li",
        "#detailBulletsWrapper li",
      ];

      for (const selector of selectors) {
        try {
          const aboutItems = await this.page.$$eval(selector, (elements) => {
            return elements
              .map((el) => el.textContent.trim())
              .filter((text) => text.length > 0);
          });
          if (aboutItems.length > 0) {
            console.log("Found about items");
            return aboutItems;
          }
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      return [];
    } catch (error) {
      console.log("Error extracting about item:", error);
      return [];
    }
  }

  async extractProductInfo() {
    try {
      // Try multiple selectors for product information
      const selectors = [
        "#productDetails_techSpec_section_1 tr",
        "#productDetails_detailBullets_sections1 tr",
        ".a-expander-content.a-expander-partial-collapse-content tr",
        "#detailBulletsWrapper tr",
        ".a-row.a-expander-container.a-expander-inline-container tr",
      ];

      for (const selector of selectors) {
        try {
          const info = await this.page.$$eval(selector, (rows) => {
            const details = {};
            rows.forEach((row) => {
              const key = row.querySelector("th")?.textContent.trim();
              const value = row.querySelector("td")?.textContent.trim();
              if (key && value) {
                details[key] = value;
              }
            });
            return details;
          });
          if (Object.keys(info).length > 0) {
            console.log("Found product info");
            return info;
          }
        } catch (e) {
          console.log(`Selector ${selector} not found, trying next...`);
        }
      }
      return {};
    } catch (error) {
      console.log("Error extracting product info:", error);
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
        throw new Error("Failed to load product page");
      }

      console.log("Extracting product data...");
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

      // Log the extracted data
      console.log("Extracted data:", JSON.stringify(productData, null, 2));

      // Validate that we got at least some data
      if (!productData.product_name && !productData.selling_price) {
        console.log("ERROR: No essential data extracted");
        throw new Error(
          "Failed to extract product data. The page might have changed or is blocking access."
        );
      }

      console.log("Scraping completed successfully");
      return productData;
    } catch (error) {
      console.error("Error during scraping:", error.message);
      console.error("Full error details:", error);
      throw error;
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
app.use(express.json());

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: "An error occurred while processing your request.",
  });
});

// Add timeout handling
app.use((req, res, next) => {
  res.setTimeout(300000); // 5 minutes timeout
  next();
});

// Add the /scrape route handler
app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: "URL is required" });
  }

  try {
    const result = await handleScrapeRequest(url);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      error:
        "An error occurred while scraping the product. Please try again later.",
    });
  }
});

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
          .retry-button { margin-top: 10px; }
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
                headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: JSON.stringify({ url })
              });
              
              if (!response.ok) {
                let errorMessage = 'HTTP error! status: ' + response.status;
                try {
                  const errorData = await response.json();
                  if (errorData && errorData.error) {
                    errorMessage = errorData.error;
                  }
                } catch (e) {
                  // If we can't parse the error response, use the default message
                }
                throw new Error(errorMessage);
              }
              
              const data = await response.json();
              if (data.success) {
                result.innerHTML = '<div class="success">Scraping successful!</div>';
                
                // Format and display the data in sections
                const formattedData = formatData(data.data);
                result.innerHTML += formattedData;
              } else {
                result.innerHTML = '<div class="error">Error: ' + data.error + '</div>';
                result.innerHTML += '<button class="retry-button" onclick="scrapeProduct()">Retry</button>';
              }
            } catch (error) {
              result.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
              result.innerHTML += '<button class="retry-button" onclick="scrapeProduct()">Retry</button>';
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

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

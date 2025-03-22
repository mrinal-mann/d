# Amazon India Smart TV Scraper (Node.js)

This is a Node.js-based web scraper that extracts detailed information about smart TV products from Amazon India. The scraper captures comprehensive product information including specifications, images, offers, and reviews.

## Features

The scraper extracts the following information:

- Product Name
- Rating
- Number of Ratings
- Selling Price
- Total Discount
- Bank Offers
- About this item (product features)
- Product Information (technical specifications)
- Amazon Product Images
- Manufacturer Section Images
- AI-Generated Customer Review Summary

## Requirements

- Node.js 14.0 or higher
- Chrome browser installed
- Internet connection

## Installation

1. Clone this repository or download the files

2. Install the required packages:

```bash
npm install
```

This will install all necessary dependencies:

- puppeteer: For web automation and scraping
- cheerio: For HTML parsing
- moment: For timestamp handling
- user-agents: For rotating user agents

## Usage

1. Run the scraper:

```bash
npm start
```

or

```bash
node amazonTvScraper.js
```

2. When prompted, enter the Amazon India smart TV product URL you want to scrape.

3. The scraper will create a JSON file with the scraped data in the current directory. The filename will include the timestamp of when the scraping was performed.

## Output

The scraper saves all data in JSON format with the following structure:

```json
{
    "product_name": "string",
    "rating": number,
    "num_ratings": number,
    "selling_price": number,
    "discount": "string",
    "bank_offers": ["string"],
    "about_item": ["string"],
    "product_info": {
        "key": "value"
    },
    "product_images": ["url"],
    "manufacturer_images": ["url"],
    "ai_review_summary": "string",
    "scrape_timestamp": "datetime",
    "source_url": "url"
}
```

## Notes

- The scraper uses Puppeteer in headless mode to handle dynamic content
- It includes random user agent rotation to avoid detection
- All data is saved with proper Unicode handling for Indian languages
- The scraper includes error handling and graceful failure for missing data

## Legal Notice

This scraper is for educational purposes only. Make sure to review and comply with Amazon's terms of service and robots.txt before using this scraper. Include appropriate delays between requests and respect the website's policies.

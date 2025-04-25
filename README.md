# Link Checker

A web application for scanning websites and identifying broken links. This tool crawls a website, checks all links, and produces a detailed report of any broken or problematic links found.

## Features

- **Website Scanning**: Enter any URL to scan for broken links
- **Customizable Depth**: Set how deep the crawler should go
- **Progress Tracking**: Monitor the scanning progress with status updates
- **Export Options**: Export results in JSON, CSV, or HTML formats
- **History Tracking**: Save scans for later reference
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/link-check.git
cd link-check
```

2. Install dependencies
```bash
npm install
# or 
yarn install
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
# or
yarn build
yarn start
```

## Docker Deployment

The application can be containerized using Docker for easy deployment.

### Building the Docker Image

```bash
docker build -t link-checker .
```

### Running the Container

```bash
# Run with ephemeral storage (scan history will be lost when container is removed)
docker run -p 3000:3000 link-checker

# Run with persistent storage for scan history
docker run -p 3000:3000 -v $(pwd)/scan_history:/app/.scan_history link-checker
```

Then access the application at [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter a website URL in the input field
2. Set the scan depth (how many clicks from the starting URL to follow)
3. Optionally configure advanced settings
4. Click "Start Scan" to begin the scan
5. View results, filter by link status (broken, ok, external, skipped)
6. Export or save results as needed

## Technologies Used

- Next.js
- React
- TypeScript
- TailwindCSS
- Cheerio (for HTML parsing)
- Radix UI (for accessible components)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- TailwindCSS UI for design inspiration
- Radix UI for accessible components
- Cheerio for HTML parsing

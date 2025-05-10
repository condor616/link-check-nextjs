# Link Checker

A web application for scanning websites and identifying broken links. This tool crawls a website, checks all links, and produces a detailed report of any broken or problematic links found.

## Features

- **Website Scanning**: Enter any URL to scan for broken links
- **Customizable Depth**: Set how deep the crawler should go
- **Advanced Filtering**:
  - Exclude links matching regex patterns
  - Skip links within specific CSS selectors
- **Progress Tracking**: Monitor the scanning progress with status updates
- **Export Options**: Export results in JSON, CSV, or HTML formats
- **History Tracking**: Save scans for later reference
- **Responsive Design**: Works on desktop and mobile devices
- **Multiple Storage Options**: Choose between file-based storage or Supabase database

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- (Optional) Supabase account for database storage

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

3. Set up application configuration
   - Copy the template configuration file:
   ```bash
   cp .app_settings.template.json .app_settings.json
   ```
   - By default, the application uses file-based storage. You can configure Supabase later in the application UI.

4. (Optional) Configure Supabase connection
   - Create a `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
   - Alternatively, you can configure Supabase connection in the Settings page after starting the application

5. Start the development server
```bash
npm run dev
# or
yarn dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

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

# Run with persistent storage for scan history and application settings
docker run -p 3000:3000 \
  -v $(pwd)/scan_history:/app/.scan_history \
  -v $(pwd)/scan_configs:/app/.scan_configs \
  -v $(pwd)/scan_params:/app/.scan_params \
  -v $(pwd)/app_settings.json:/app/.app_settings.json \
  link-checker

# Run with Supabase environment variables
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  link-checker
```

Before using the persistent storage option, create an app_settings.json file in your host directory:

```bash
# Create an app_settings.json file from the template
cp .app_settings.template.json app_settings.json

# Edit the file if you want to use Supabase
# For file-based storage, you don't need to modify it
```

Then access the application at [http://localhost:3000](http://localhost:3000)

## Storage Options

The application supports two storage methods:

### File-based Storage (Default)

By default, all scan configurations, results, and parameters are stored in JSON files in the following directories:
- `.scan_configs` - Saved scan configurations
- `.scan_history` - Scan history results
- `.scan_params` - Scan parameters

### Supabase Storage

You can configure the application to use Supabase for data storage:

1. Create a Supabase project at [https://supabase.io](https://supabase.io)
2. Get your project URL and anon key from the Supabase dashboard
3. Configure these credentials either:
   - In the Settings page of the application
   - Via environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. After configuring Supabase, initialize the schema by clicking "Initialize/Reset Supabase Schema" in the Settings page

You can switch between storage methods at any time in the Settings page. Data in both storage methods is preserved when switching.

## Usage

1. Enter a website URL in the input field
2. Set the scan depth (how many clicks from the starting URL to follow)
3. Optionally configure advanced settings:
   - Set concurrency (number of simultaneous requests)
   - Add regex patterns to exclude matching URLs from scanning
   - Add CSS selectors to skip links contained within matching elements
4. Click "Start Scan" to begin the scan
5. View results, filter by link status (broken, ok, external, skipped)
6. Export or save results as needed

### Regex Exclusion Examples

- `\/assets\/.*\.pdf$` - Exclude all PDF files in the assets directory
- `example\.com\/newsletter` - Skip all URLs containing "example.com/newsletter"
- `\/archive\/\d{4}\/` - Exclude archive URLs with year patterns

### CSS Selector Examples

- `.footer` - Skip all links within footer elements
- `#navigation` - Exclude links in the navigation area
- `[data-noindex]` - Skip links in elements with the data-noindex attribute
- `.sidebar, .ads` - Exclude links in both sidebar and ads elements

## Technologies Used

- Next.js
- React
- TypeScript
- TailwindCSS
- Cheerio (for HTML parsing)
- Radix UI (for accessible components)
- Supabase (optional, for database storage)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- TailwindCSS UI for design inspiration
- Radix UI for accessible components
- Cheerio for HTML parsing
- Supabase for database functionality

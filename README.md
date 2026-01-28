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
- **Robust Storage**: Uses SQLite (via Prisma) by default, with optional Supabase support
- **Background Processing**: Dedicated worker for handling long-running scans

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/condor616/link-check-nextjs.git
cd link-check
```

2. Install dependencies
```bash
npm install
# or 
yarn install
```

3. Set up environment and database
   - Copy the template configuration file:
   ```bash
   cp .app_settings.template.json .app_settings.json
   ```
   - Create a `.env` file (required for database connection):
   ```bash
   cp .env.example .env
   ```
   - Initialize the SQLite database:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. Start the application (Development)
   This command starts both the Next.js web application and the background worker concurrently.
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Stopping the Application

To stop the application, simply press `Ctrl+C` in the terminal where the application is running.

### Managing the Worker

The application uses a background worker to process scan jobs.

- **Development**: When running `npm run dev`, the worker starts automatically alongside the web app.
- **Production**: You must run the worker separately.

#### Running in Production (LXC / VPS / Docker)

1. Build the application:
```bash
npm run build
```

2. Start everything (Server + Worker + Migrations):
```bash
# Ensure DATABASE_URL is set in your environment
npm start
```

**Note**: The simplified `npm start` command will automatically apply database migrations and start both the Next.js server and the background worker.

## Docker Deployment

The application can be containerized using Docker for easy deployment.

### Building the Docker Image

```bash
docker build -t condor616/link-check:latest .
```

### Running the Container

```bash
# Run with persistent storage for database and history
docker run -p 3000:3000 \
  -v $(pwd)/prisma:/app/prisma \
  -v $(pwd)/.scan_history:/app/.scan_history \
  -v $(pwd)/.app_settings.json:/app/.app_settings.json \
  condor616/link-check:latest
```

Then access the application at [http://localhost:3000](http://localhost:3000)

## Storage Options

The application supports two storage methods:

### SQLite Storage (Default)

By default, the application uses a local SQLite database (via Prisma) to store:
- Scan configurations
- Scan history and results
- Job status and progress

The database file is located at `prisma/dev.db`.

### Supabase Storage

You can configure the application to use Supabase for data storage:

1. Create a Supabase project at [https://supabase.io](https://supabase.io)
2. Get your project URL and anon key from the Supabase dashboard
3. Configure these credentials either:
   - In the Settings page of the application
   - Via environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. After configuring Supabase, initialize the schema by clicking "Initialize/Reset Supabase Schema" in the Settings page

You can switch between storage methods at any time in the Settings page.

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

- Next.js 15+
- React 19
- TypeScript
- Bootstrap 5 & Sass
- Prisma (SQLite)
- Cheerio (for HTML parsing)
- Supabase (optional, for database storage)
- Lucide React (for icons)
- Framer Motion (for animations)

## Troubleshooting

### Common Issues

#### 1. Missing `DATABASE_URL` Environment Variable

**Error:** `PrismaConfigEnvError: Missing required environment variable: DATABASE_URL`

**Solution:**
Ensure you have a `.env` file in the root directory. You can create one from the example:

```bash
cp .env.example .env
```

For local development with SQLite, the file should contain:
```
DATABASE_URL="file:./dev.db"
```

#### 2. Database Tables Missing

**Error:** `PrismaClientKnownRequestError: The table main.Job does not exist in the current database.`

**Solution:**
The database schema hasn't been pushed to your local database. Run the following command to create the tables:

```bash
npx prisma db push
```

## Vercel Deployment

To deploy this application to Vercel, follow these steps:

1. **Prerequisite**: Set up a Supabase project and obtain your `DATABASE_URL` (PostgreSQL).
2. **Environment Variables**: Add the following to your Vercel project:
   - `DATABASE_URL`: Your Supabase connection string.
   - `NEXT_PUBLIC_SUPABASE_URL`: (Optional, if using Supabase client).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Optional, if using Supabase client).
3. **Build Command**: `npm run build`
4. **Worker Configuration**:
   - **Persistence (Non-Serverless)**: Host the worker using `node .next/standalone/worker.js` on a platform like Render, Railway, or a VPS.
   - **Serverless (Vercel)**: 
     - Use the provided API route: `/api/worker`.
     - Set up a **Vercel Cron Job** in your `vercel.json` to call this endpoint periodically.
     - Example `vercel.json`:
       ```json
       {
         "crons": [
           {
             "path": "/api/worker",
             "schedule": "*/5 * * * *"
           }
         ]
       }
       ```

## Optimizations

- **Build Pipeline**: Consolidated `package.json` scripts into a single `npm run build` command that handles Prisma generation, Next.js build, and worker bundling.
- **Database Performance**: Added indexes to `Job.status` and `Job.created_at` for efficient polling.
- **Shared Logic**: Extracted worker processing into a shared core, enabling the same logic to run in either a persistent loop or a serverless request.



## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- TailwindCSS UI for design inspiration
- Radix UI for accessible components
- Cheerio for HTML parsing
- Supabase for database functionality
- Prisma for database ORM

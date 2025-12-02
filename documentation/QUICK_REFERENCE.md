# Link Checker Pro - Quick Reference Guide

## Quick Start

### Installation
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t link-checker .
docker run -p 3000:3000 link-checker
```

---

## Common Tasks

### 1. Run a Basic Scan
1. Go to `/scan`
2. Enter URL: `https://example.com`
3. Click "Start Scan"
4. Click "Confirm Scan"
5. View results

### 2. Run an Advanced Scan
1. Go to `/scan`
2. Enter URL
3. Click "Show Advanced Options"
4. Add exclusions:
   - **Regex**: `\/assets\/.*\.pdf$`
   - **CSS**: `.footer`
5. Adjust depth/concurrency
6. Click "Start Scan"

### 3. Save a Scan Configuration
1. Configure scan settings
2. Click "Save Scan" (bottom of form)
3. Enter name: "My Website Scan"
4. Click "Save Scan" in dialog

### 4. Load a Saved Configuration
**Method 1** (From Scan Page):
1. Go to `/scan`
2. Click "Load Scan"
3. Select configuration
4. Form auto-populates

**Method 2** (From Saved Scans):
1. Go to `/saved-scans`
2. Click "Edit" on desired scan
3. Form auto-populates

### 5. View Scan History
1. Go to `/history`
2. Click "View" on any scan
3. Use filters to focus on specific links:
   - Problematic Links
   - OK Links
   - External Links
   - Skipped Links

### 6. Export Scan Results
1. View scan details (`/history/[scanId]`)
2. Click "Export" button
3. Choose format:
   - JSON
   - CSV
   - HTML

### 7. Switch to Supabase Storage
1. Create Supabase project
2. Get URL and anon key
3. Go to `/settings`
4. Select "Supabase Database"
5. Enter credentials
6. Click "Initialize/Reset Supabase Schema"
7. Verify with "Check Table Status"

---

## Configuration Examples

### Exclude PDF Files
**Regex Pattern**: `.*\.pdf$`

### Exclude Entire Directory
**Regex Pattern**: `\/blog\/.*`

### Exclude Multiple Patterns
```
\/assets\/.*
\/downloads\/.*
.*\.zip$
```

### Exclude Footer Links
**CSS Selector**: `.footer`

### Exclude Multiple Sections
```
.footer
.sidebar
#navigation
```

### Scan Protected Site
1. Click "Show Advanced Options"
2. Enable "HTTP Authentication"
3. Enter username and password
4. Run scan

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Navigate to Scan | Click "New Scan" in nav |
| Navigate to History | Click "History" in nav |
| Navigate to Saved Scans | Click "Saved Scans" in nav |
| Navigate to Settings | Click "Settings" in nav |

---

## Troubleshooting

### Scan Fails to Start
**Possible Causes**:
- Invalid URL format
- Website is down
- Network connectivity issues

**Solutions**:
- Verify URL starts with `http://` or `https://`
- Test URL in browser
- Check internet connection

### Scan Times Out
**Possible Causes**:
- Large website
- Slow server response
- Low timeout setting

**Solutions**:
- Increase timeout value (Settings)
- Reduce scan depth
- Reduce concurrency

### No Results Displayed
**Possible Causes**:
- All links excluded by filters
- Website has no links
- JavaScript-only navigation

**Solutions**:
- Check exclusion patterns
- Verify website has HTML links
- Note: JavaScript-rendered links not detected

### Supabase Connection Fails
**Possible Causes**:
- Incorrect credentials
- Network issues
- Schema not initialized

**Solutions**:
- Verify URL and key
- Check internet connection
- Click "Initialize/Reset Supabase Schema"

### Export Not Working
**Possible Causes**:
- Browser blocking download
- Large result set

**Solutions**:
- Allow downloads in browser
- Try different export format
- Filter results before exporting

---

## API Quick Reference

### Scan a Website
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "config": {
      "maxDepth": 2,
      "concurrency": 5
    }
  }'
```

### Get Scan History
```bash
curl http://localhost:3000/api/history
```

### Get Specific Scan
```bash
curl http://localhost:3000/api/history/scan_1234567890_abc123
```

### Save Configuration
```bash
curl -X POST http://localhost:3000/api/save-scan \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Scan",
    "config": {
      "url": "https://example.com",
      "maxDepth": 2
    }
  }'
```

---

## Default Values

| Setting | Default Value |
|---------|---------------|
| Scan Depth | 2 |
| Concurrency | 5 |
| Request Timeout | 30 seconds |
| Storage Type | File-based |
| Max Results Display | All |

---

## File Locations

### Configuration Files
- **App Settings**: `.app_settings.json`
- **Environment**: `.env.local`

### Data Directories
- **Scan Configs**: `.scan_configs/`
- **Scan History**: `.scan_history/`
- **Scan Params**: `.scan_params/`

### Docker Volumes
```bash
# Persistent storage
-v ./scan_history:/app/.scan_history
-v ./scan_configs:/app/.scan_configs
-v ./scan_params:/app/.scan_params
-v ./app_settings.json:/app/.app_settings.json
```

---

## Status Codes

| Status | Meaning |
|--------|---------|
| **OK** | Link is valid (200-299) |
| **Broken** | Link is broken (400-599) |
| **External** | Link points to external domain |
| **Skipped** | Link excluded by filters |

---

## Best Practices

### For Small Websites (< 100 pages)
- Depth: 3-5
- Concurrency: 10
- Timeout: 30s

### For Medium Websites (100-1000 pages)
- Depth: 2-3
- Concurrency: 5-10
- Timeout: 30s

### For Large Websites (> 1000 pages)
- Depth: 1-2
- Concurrency: 3-5
- Timeout: 60s
- Use exclusion patterns

### For Protected Websites
- Enable HTTP authentication
- Use appropriate credentials
- Test with single page first

### For Regular Monitoring
- Save scan configuration
- Use Supabase for persistence
- Export results for comparison
- Schedule scans externally (cron)

---

## Environment Variables

### Required for Supabase
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

### Optional
```bash
NODE_ENV=production
PORT=3000
```

---

## Support & Resources

### Documentation Files
- `COMPREHENSIVE_FEATURE_LIST.md` - Detailed feature documentation
- `TECHNICAL_ARCHITECTURE.md` - Architecture and technical details
- `README.md` - Project overview and setup
- `QUICK_REFERENCE.md` - This file

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [Cheerio Documentation](https://cheerio.js.org/)

---

## Common Regex Patterns

### File Extensions
```regex
.*\.pdf$          # PDF files
.*\.(jpg|png)$    # Images
.*\.zip$          # ZIP files
```

### Directories
```regex
\/admin\/.*       # Admin section
\/api\/.*         # API endpoints
\/assets\/.*      # Assets folder
```

### Patterns
```regex
\/\d{4}\/\d{2}\/  # Date-based URLs (2024/01/)
.*\?.*            # URLs with query strings
#.*               # Anchor links
```

---

## Common CSS Selectors

### By Class
```css
.footer           # Footer elements
.sidebar          # Sidebar elements
.navigation       # Navigation elements
```

### By ID
```css
#header           # Header element
#menu             # Menu element
```

### By Attribute
```css
[data-noindex]    # Elements with data-noindex
[rel="nofollow"]  # Nofollow links
```

### Combined
```css
.footer, .sidebar, #ads    # Multiple selectors
```

---

## Version Information

- **Application Version**: 0.1.0
- **Next.js Version**: 15.3.1
- **React Version**: 19.0.0
- **Node.js Required**: 18+

---

## License

MIT License - See LICENSE file for details

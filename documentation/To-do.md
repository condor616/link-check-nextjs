- Add http_basic auth feature. If the site is protected by http_basic auth, after the scan is started, show a popup where user can add the username and password. 
User can add credentials before the scan is started, or, if the app detects that the resource is protected, ask the user for credentials before triggering the scan.

- Add cookie based connection. Some of my websites are only accessible via login. I want to be able to pass http headers (you tell me which ones) before I start the scan.

Check for broken images too. 
Add the following options in configuration: "Check images" and "Check scripts and stylesheets". If they are enabled the check is done, otherwise skipped, for these types 

Add possibility to check for broken images. This option is available before the scan (advance option). Default is on. 

Make the site responsive, all pages. Especially the hostory scan page (at the moment i don’t see the buttons to view a past scan, on mobile)

Make the header navigation responsive, with hamburger menu and cool transitions.


- Cache bypass - Append a timestamp to the URL to bypass the cache (i.e. ?t=1234567890)
- Add live log in the scan details page, so user knows what's happening
- fix progress bar (currently says 0%)
- in scan result page (the one with all filters) add a text based filter, so I can check for a specific URL/Link
- Possibility to switch themes
- Add dark mode function
- Backup and restore data feature

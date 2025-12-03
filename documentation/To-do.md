- Add http_basic auth feature. If the site is protected by http_basic auth, after the scan is started, show a popup where user can add the username and password. 
User can add credentials before the scan is started, or, if the app detects that the resource is protected, ask the user for credentials before triggering the scan.

- In ther output page, I want to be able to search for a specific link and know if if it is broken, and where does it appear (in which page, so I can go and fix it). The search feature must be fast and reliable

- Add possibility to save a preset of the regex or css selector. SO I don't have to write all regex/css every time I run a scan. 
Before starting the scan, user can enter new regex/css, or select from a predefined list. 
When writing new regex/css, before starting the scan, allow the possibility to save the filter criteria. All the criteria are listed in a search-filters page. 
User can write new filters, or select existing ones from a dropdown. 
Allow, in search-filter, to manage the presets (add, edit, delete)
Allow possibility to export and import preset (regex and css) which can be reused in any future scan

- Add the config option, before scan, to check external links. DO not iterate in the external link, just check if it's a 200 or not, and add this information to the external links tab in the results page. 
I want to know if an external link is still valid, or broken. But I don't want to scan the content of the page lined by the external link

- The popup displaying html snippet should be improved and be more readable. Add html beautifier and avoid listing <style> in the output
- Fix the pagination dropdown. At the moment, I have to click twice to select the pagination. Make it so that when I click on the dropdown, I can immediatelly select the pagination
- Add a button to export the scan, in the history page. At the momement, the export feature is only available within the scan page itself (not within the page listing all the scans)
- Improve the "Advance configuration" page: the "add pattern" and "add css" button should not be in a new line. Place these button next to the field. A simple "+" button. This will make the page more compact

- Add cookie based connection. Some of my websites are only accessible via login. I want to be able to pass http headers (you tell me which ones) before I start the scan.

- If a resource is protected by http_basic, then all the pages within the resource are protected. Make sure to use the credentials for the entire scan (all pages, not just the root one)

Provide option, before scan, to just scan this specific page (via checkbox). If this is checked, only the provided page is scanned, and the scan doesn’t go further with crawling the links. 
If this option is checked, bring the depth value to zero (in a nice smooth transition, the value of deprh is set to zero if the option is checked. If the option is unchecked again, restore depth value)

---DONE---
Are links to pdf file currently being checked?
Make sure all links are checked (i.e. js files or resources loaded by cdn. If a link is pointing to a 404 or the resource doesn’t exist, i want to know.)
Check for broken images too. 
Add the following options in configuration: "Check images" and "Check scripts and stylesheets". If they are enabled the check is done, otherwise skipped, for these types 
---

Add possibility to check for broken images. This option is available before the scan (advance option). Default is on. 

Make sure all above additions play well with the output generated. I want to see all broken links. 

Make the site responsive, all pages. Especially the hostory scan page (at the moment i don’t see the buttons to view a past scan, on mobile)

For desktop, i want you to optimize and beautify the header navigation. Make sure it stands out from the rest of the content below. 
Make the header navigation responsive, with hamburger menu and cool transitions.

The overall app UX is slow. When switching between pages, i want smooth transition, with effects. Keep the animation and effect professional. 

Improve the look and feel of the site.
The main content is too centered, it can be wider (don’t need the empty columns on the sides). I want the app edge to edge on desktop. 
Add a bit more color (keep it dark, but at the moment it’s boring to have only black and grey. 

Add smooth and particular effects to various aspect of the apps. For example, when i start a scan, i have to scroll down to check the results. Maybe you can make the scan form disappear, when user starts the scan, and replace it with the actual scan progress amd results. 
Add navigation buttons with cool hover effects, which make the app easy and smooth to navigate. 


---------

- Cache bypass - Append a timestamp to the URL to bypass the cache (i.e. ?t=1234567890)
- Add live log in the scan details page, so user knows what's happening
- fix progress bar (currently says 0%)
- in scan result page (the one with all filters) add a text based filter, so I can check for a specific URL/Link

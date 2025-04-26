- Add http_basic auth feature. If the site is protected by http_basic auth, after the scan is started, show a popup where user can add the username and password. 

- In ther output page, I want to be able to search for a specific link and know if if it is broken, and where does it appear (in which page, so I can go and fix it). The search feature must be fast and reliable

- Add possibility to save a preset of the regex or css selector. SO I don't have to write all items every time I run a scan. 
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
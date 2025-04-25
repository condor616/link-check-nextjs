
I am a web developer responsible to develop and maintain up to 60 websites. 
I also manage the content, and need to make sure there are no broken links in all the pages of my website.

I need a link-checker application, which allows me to scan an entire website, and identify broken links.
I need a flexible solution, and professional. 

The interface must be simple and intuitive, but when needed, extremely technical and with lot of options to configure the scan.

Here what I need:
- I enter the url of the website, and the application scans everything. Provide an option to specify the depth of the search. But by default, depth is the highest, cause I want to scan everything
- The application must be fast, so for example don’t scan the same link twice (add this as configuration option, default “do not scan the same link twice”)
- I want a very detailed and clear output. Provide different output formats (json, html, cvs)
- For a broken link, I want to know all the pages where this link is used. This should be part of the report. It’s the most important thing I need, cause it will tell me where to go and fix this broken link.
- The output html file must be simple, clear and flexible enough for me to see all the details I need:
    - Broken link
    - Anything that is not a broken link, should be listed down the page, or in a different tab.
    - Organize the html page in tabs, based on the criticality of the report. 
    - Each link is displayed as collapsed accordion. User click on the accordion to expand it and look at the details (i.e. all the other pages containing this broken link)
- Provide an option to save the output for future access (like an history). The output can be saved in a folder as JSON, or whatever format works best. User can visit and manage (delete) previous scans. Make this available in dedicated “History” page
- Provide an option to export a previous scan (into html or cvs). 
- When a scan is completed, or paused, or terminated by the user, ask the user if he wants to save this “partial” scan in the history, and also offer the option to export the scan as a file that can be downloaded. 
- I want to see the scan running, in a nice and clean logs page where I can see everything which link is being processed, the progress, and all useful information you can think of. 
- Before starting a scan, I want to configure the various options. Think of useful option we can include. We can have “advance” option that are visible only if the user clicks “Use advanced options”. Here the option I definitely want (but you should add more):
    - Possibility to specify links that you don’t want to include in the scan
        - Via URL
        - Via regex. For example: all my sites are running under same top level domain. Example.com for the main website, example.com/it-it/ for the Italian website, example.com/ch-de and example.com/ch-fr/ for the Swiss website (in two languages)
        - Via CSS selector (everything with this classname is to be ignored, or everything below (in the DOM) this classname should not be included in the scan.  

UI / Interface
    - I want a modern and clean UI. 
    - I want a NextJS application, with caching animation, and smooth transition between the various pages of the application
    - Use a dark theme. Choose color wisely. I want the application to be readable, and accessible. 
    - The application must be responsive

Technology
- NextJS
- Local json storage to start. We can integrate with Supabase later on
- Tailwind CSS
- ShadnUI
- Provide npm tasks to manage the application (compile, start, stop, vercel-dev, vercel-build, … and more as you see fit. 
- Provide a Dockerfile so I can run the application via docker. 
- Use eslint and make sure you always check if there are errors, and fix them 

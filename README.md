# What is this

I was playing around with a tool that sends some prompts to a running stable diffusion webui instance but I didn't have as much control over the prompts as I wanted so I made this quick
tool to more or less hijack the call and insert whatever I wanted in there. 

This also allows you to bypass any browser CORS requirements since you have to manually click the “generate” button (the prompt, negative prompt and seed will be filled out for you
automatically).

## Isn't this kind of overboard?

Yes, probably? This could have been a lot simpler if your goal is simply to customize the prompts present in the POST requests. But, I was also running into some CORS issues that I couldn't
easily fix  since I was running my Stable Diffusion WebUI instance in the cloud on Paperscape and for some reason, none of the cors settings were working. Idk, I'm sure someone way
smarter than me could have figured out the CORS issue but I decided to just make this instead, plus it was kind of fun since I did learn a lot (more than I wanted to, really) about
browser permissions and safety.

## How does it work?

You run your own local server (or on Vercel, doesn't matter) and you point whatever is sending out the POST requests to your SD WebUI instance to this server. This server will communicate
with a background script running as an extension on your browser (because browser security is very tight nowadays, you can't have websockets open between a user/contentscript and a server).
The background script will send this request to a content script which will fill the appropriate fields. You can change then further customize the prompts as wanted, and it will be generated
based on the settings you have selected on the page. You _must_ click generate yourself (I could have had the script do this for me but I wanted to click it when I was done customizing).

## Installation

1. Clone the repo to your machine: `git clone <url-of-this-repo>`
2. Navigate to the directory this repo is in. `cd <path-to-this-downloaded-repo-on-your-machine>`
3. Execute `npm init` and then `node server.js`
4. The server should now be running on port 7860 (can be changed in `server.js` file)
5. Now, upload the browser extension by navigating over to `chrome://extension` (sorry I only tested this for chrome, this is just a personal project), click upload unpacked extension. Upload the extension folder, give it whatever permissions it needs as well as the permission to read local files.
6. Make sure the extension is loaded, then click on the link present on your `chrome://extension` page to open a new window where you can see the console messages the extension is printing. This will also make sure chrome does not put the extension to sleep (it will not work if it's asleep sadly, the web socket connection between the extension and your running server will close).
7. Make sure you change the URLs present in `background.js` and `manifest.json` so that they point to your Stable Diffusion WebUI Instance. Refresh your extension on the extensions page.
8. Point whatever is sending the API requests to your server (if it's from some non-locally running source, you will have to host the server on Vercel - this is free btw). Whenever your server
recieves a POST request, click generate on your WebUI. All generated images are saved on a local file called `requests.log` (as in the URL to the generated images, they should all be valid assuming
you did not close your SD instance at any point between generating that image and opening the URL).

/**
   File: server.js
   Description: Point api calls from a server/website to this server and manually run the prompts yourself. Mainly meant for tasks where you don't have the customization/control over image generating prompts that you wish you had. You can also store all of the prompts that are sent in a local file.
   Author: Anmol
   Created on: 28/11/2023
   Last Modified: 04/12/2023
   Version: 1.0.0
   Usage: Run 'npm start server.js' in your terminal (assuming the terminal's directory is the folder this server.js file is in. 
*/

// libraries we need to recieve and send REST api calls
// axios for image manipulation (converting to and from base64)
// uses websockets to communicate with the scripts manipulating the SD WebUI
// change PORT to something else if you desire.
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const filePath = 'requests.log'
const crypto = require('crypto'); // for generating hashes
const port = 7860;
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

/**
   We use a websocket to communicate/send messages between this server and the
   script(s) running on our browser. Note, this websocket is unsecured because
   it's not really practical to get the right certificates to run a secured websocket
   connection on a local server.
   */
wss.on('connection', function connection(ws) {

    /**
       Web browser script sends a url to the image the SD WebUI has generated.
       This message recieves it and writes it to a local file 'requests.log'
       The POST request handler reads from this file to grab the image it requested.
       
       @param {string} jsonMessage - url is sent in a json object
       */
    ws.on('message', function incoming(jsonMessage) {
        // Handle incoming messages from WebSocket clients
        try {
            let message = JSON.parse(jsonMessage);
            console.log('json parsed message: ', message);
            if (message && message.imageUrl) {
                let imageUrl = message.imageUrl;

                // Read the current content of the file to check if it's empty
                fs.readFile('requests.log', 'utf8', (readErr, data) => {
                    if (readErr && readErr.code !== 'ENOENT') {
                        // Handle errors other than 'file not found'
                        console.error('Error reading file:', readErr);
                        return;
                    }

                    // Determine whether to prepend a newline
                    const prefix = data ? '\n' : '';

                    // Append the image URL to the file
                    fs.appendFile('requests.log', prefix + imageUrl + '\n', (appendErr) => {
                        if (appendErr) console.error('Error appending web socket data to file:', appendErr);
                    });
                });
            } else {
                console.error('Message does not contain an image url');
            }
        } catch (e) {
            console.error('Error parsing JSON file');
        }
    });

    ws.on('close', function close() {
        console.log('client disconnected');
    });

    ws.on('error', function error(err) {
        console.error('web socket error: ', err);
    });

    // Send a message to the connected client
    ws.send('Connection established');
});


function broadcastToWebSockets(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

/**
   When this server recieves a POST request, it will write it to a file along with
   a unique hash to be able to weed out duplicate requests.
   */
function generateHash(data) {
    const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return 'hash: ' + hash;
}

// Function to check if the request is unique
function isUniqueRequest(requestData, existingData) {
    const requestHash = generateHash(requestData);
    return !existingData.includes(requestHash);
}

// Function to read existing data from file
function readDataFromFile(callback) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading from file:', err);
            callback(err, null);
        } else {
            callback(null, data);
        }
    });
}

// Handle OPTIONS (Preflight) request
app.options('/sdapi/v1/txt2img', (req, res) => {
  res.status(204).send();
});

// Handle POST request
app.post('/sdapi/v1/txt2img', (req, res) => {

    if (req.body.prompt) {
	// if you know exactly what you want to change everytime, you can manipulate the
	// prompt here. This is for the positive prompt.
    }

    if (req.body.negative_prompt) {
	// and this is for manipulating the negative prompt. I've put down an example below.
	// It replaces a LoRA specific signifier (1.1) to nothing
        req.body.prompt = req.body.prompt.replace(/:1\.1/g, '');
    }

    // send out the prompts to our script listening in our browser.
    broadcastToWebSockets(req.body);

    /**
       now the server will check every five seconds if there's a new url written to
       requests.log, if there is, the server knows an image was generated and it
       will decode the image to base64 and complete the POST request.

       TODO: Add logic to completely avoid running this function and instead sends out
       'nothing' if the user wishes to simply have the prompts be written to a file
       that they can then read manually or with some special script of their own.

       TODO: Re-add the logic that writes the request.body to a file for said script
       to be able to read.
    */
    async function retrieveImageAndRespond() {
        try {
            // Read the last line from the file
            const data = fs.readFileSync('requests.log', 'utf8');
            const lines = data.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            // console.log('has last line been read yet?', lastLine);

            // first checks if file is not empty (aka last line being undefined)
            if (lastLine && !lastLine.startsWith('READ')) {
                // Retrieve the image from the URL
                console.log('the last line is at: ', lastLine);
                const response = await axios.get(lastLine, { responseType: 'arraybuffer' });
                // console.log('about to send to website: ', response);
                const imageBase64 = Buffer.from(response.data).toString('base64');

                // Mark the line as read
                lines[lines.length - 1] = 'READ ' + lastLine;
                fs.writeFileSync('requests.log', lines.join('\n'));

                // Send the Base64 image in the response
                console.log({ images: [imageBase64] });
                res.json({ images: [imageBase64] });
            } else {
                // If no new link, check again after some delay
                setTimeout(retrieveImageAndRespond, 5000);
            }
        } catch (error) {
            console.error('Error processing image:', error);
            res.status(500).send('Error processing request');
            setTimeout(retrieveImageAndRespond, 5000);
        }
    }

    // Start the check process
    retrieveImageAndRespond();
});


// Handle request to access requests.
/**
   Alternatively, we can run a script (with tampermonkey or something equivalent) that
   will send a rest call to read from the file. It will read all the prompts and automatically
   queue them up to be generated.

   TODO: Delete the prompts from the file after the script is finished reading.
*/
app.get('/requests', (req, res) => {
    fs.readFile('requests.log', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            res.status(500).send('Error reading file');
            return;
        }
        try {
            const hashPattern = 'hash:';
            const rawEntries = data.split(hashPattern).filter(entry => entry.trim() !== '');
            const jsonEntries = rawEntries.map(entry => {
                // Remove the first line (hash) and join the rest back into a single string
                const jsonPart = entry.split('\n').slice(1).join('\n').trim();
                try {
                    return JSON.parse(jsonPart);
                } catch (parseErr) {
                    console.error('Error parsing entry:', parseErr);
                    return null; // Return null for entries that couldn't be parsed
                }
            }).filter(entry => entry !== null); // Filter out null entries

            console.log('Parsed JSON Entries:', jsonEntries);
            res.json(jsonEntries);
        } catch (parseErr) {
            console.error('Error processing file:', parseErr);
            res.status(500).send('Error parsing JSON');
        }
    });
});

/**
   Most websites/servers that have an API to communicate with SD WebUI also send out an
   interrupt call every once in a while if something goes wrong.
   */
app.post('/sdapi/v1/interrupt', (req, res) => {
    res.json({ message: 'interrupt request recieved'} );
});

// Handle request to delete an entry
app.post('/deleteEntry', (req, res) => {
    const requestHashToDelete = req.body.hash;
    readDataFromFile((err, existingData) => {
        if (err) {
            res.status(500).send('Error reading file');
            return;
        }
        const updatedData = existingData.split('\n').filter(line => !line.includes(requestHashToDelete)).join('\n');
        fs.writeFile(filePath, updatedData, (err) => {
            if (err) {
                res.status(500).send('Error writing file');
            } else {
                res.send('Entry deleted');
            }
        });
    });
});

server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

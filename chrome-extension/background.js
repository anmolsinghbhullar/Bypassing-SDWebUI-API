/**
   File: background.js
   Description: Works in the background of your browser with necessary permissions from your web browser extension.
   It will keep open a websocket between it and your web server. It will recieve prompt data to generate an image,
   forward it to the content script, and the content script will send back a url pointing to said image as a json
   object. This script will then send back this url through the open websocket.

   Worth mentioning, the websocket is unsecured because it's not very practical to obtain the correct certifications
   for something that you're just running locally. You may run a secured websocket if you wish by hosting it on
   Vercel if you wish.
 */
const socket = new WebSocket('ws://localhost:7860');

socket.onopen = function(event) {
    console.log('WebSocket connection established');
};

socket.onerror = function(error) {
    console.error('WebSocket error:', error);
};

/**
   Upon recieving a message from our web-server, this script will forward it to the
   content script which will then generate an image and send the url of said image
   back as a response. This function will then send this url (as a JSON object) back
   to the server.
 */
socket.onmessage = function(event) {
    console.log('Message from server:', event.data);

    var messageToSend = event.data;
    try {
        messageToSend = JSON.parse(event.data);
    } catch (e) {
        console.error('Error parsing event.data:', e);
    }

    console.log('parsed data: ', messageToSend);

    /**
       Our background script only forwards the message to the tabs with the following url so we don't incessantly spam
       the 100 tabs you have open.
       ==========
       REPLACE BELOW URL OTHERWISE IT WILL NOT WORK
       ==========
    */
    chrome.tabs.query({ url: "https://website/pointing/to/your/stable-diffusion-webui-instance" }, function(tabs) {
        tabs.forEach(function(tab) {
            chrome.tabs.sendMessage(tab.id, messageToSend, function (response) {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message to tab:', chrome.runtime.lastError.message, 'Tab id:', tab.id);
                } else {
                    console.log('Response from content script:', response);
                    // Send the response back to the server via WebSocket
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify(response));
                    } else {
                        console.error('WebSocket is not open. Unable to send data');
                    }
                }
            });
        });
    });
};


/**
   Logic for handling recieved data is already done in the function above so nothing you need to do here.
 */
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log("Background script recieved message: ", message);

    // sendDataToWebSocketServer(message);
    // sendResponse({ response: "Message forwarded successfully" }); // send msg back to content script if you want
    // return true if u want to end the response asynchronously
    return true;
});

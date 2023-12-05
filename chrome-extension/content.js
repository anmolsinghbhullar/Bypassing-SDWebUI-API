/**
   File: content.js
   Description: Recieves messages from the background browser-wide script the extension runs. These messages are the prompts of the images we're generating.
   The user is expected to click the generate button themselves after checking to see if the prompt, negative prompt and seed text areas are as to their liking.
   (Please go through and click enter on those three fields because the form handling is very weird and it makes me want to rip my hair out).
   Dependencies: background.js and various extension permissions (specifically local file reading ones).
 */

// loaded content script
console.log('loaded content.js');

// 1 second wait time
// just to make sure this script is always loaded after the background browser script.
var checkInterval = 1000;

/**
   Given an xpath, it will return the textarea pointing to it.

   @param {string} path - xpath in question
*/
function getElementsByXpath(path) {
    let results = [];
    let query = document.evaluate(path, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0, length = query.snapshotLength; i < length; ++i) {
        results.push(query.snapshotItem(i));
    }
    return results;
}

/**
   Checks if the image is generating or has finished by checking the style of the generate/interrupt button.
*/
function isImageGenerating() {
    var elemIntrButton = getElementsByXpath('//*[@id="txt2img_interrupt"]')[0];
    console.log('Style of interrupt button:', elemIntrButton ? elemIntrButton.style.display : 'Element not found');
    return elemIntrButton && elemIntrButton.style.display === 'block';
}

/**
   Function that waits and only returns/breaks out of its loop when the image has finished generating
*/
function waitForImageGeneration(callback, checkInterval) {
    if (isImageGenerating()) {
        console.log('still generating...');
        setTimeout(function() {
            waitForImageGeneration(callback, checkInterval);
        }, checkInterval);
    } else {
        console.log('gen complete');
        callback();
    }
}

// Listen for messages from the background script and change DOM based on that
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Content script received message:", request);

    // Set values from the JSON request
    const promptInput = document.evaluate('//*[@id="txt2img_prompt"]/label/textarea', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (promptInput) promptInput.value = request.prompt;
    
    const promptNegInput = document.evaluate('//*[@id="txt2img_neg_prompt"]/label/textarea', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (promptNegInput) promptNegInput.value = request.negative_prompt;
    
    const seedInput = document.evaluate('//*[@id="txt2img_seed"]/label/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (seedInput) seedInput.value = request.seed;

    console.log(promptInput.value, promptNegInput.value, seedInput.value);

    // Flag to track if the button has been clicked
    let isButtonClicked = false;

    // Change the tab title to alert the user
    document.title = "User Action Needed";

    // Find the 'generate' button
    let elemGenButton = getElementsByXpath('//*[@id="txt2img_generate"]')[0];

    // Function to handle the click event
    function handleButtonClick() {
        isButtonClicked = true;
        elemGenButton.removeEventListener('click', handleButtonClick);
        document.title = "Stable Diffusion"; // Change title back
    }

    // Add a click event listener to the 'generate' button
    if (elemGenButton) {
        elemGenButton.addEventListener('click', handleButtonClick);
    }

    // Recursive function to wait for the button click
    function waitForButtonClick() {
        if (!isButtonClicked) {
            setTimeout(waitForButtonClick, 500); // Check again after 0.5 seconds
        } else {
            console.log('Button clicked, continuing execution');
            // Wait for 1 second before starting to check for image generation completion
            setTimeout(function() {
                waitForImageGeneration(function() {
                    console.log('image gen done');
                    var linkToImage = getElementsByXpath('//*[@id="txt2img_gallery"]/div[2]/img')[0].src;
                    console.log('sending the image at url: ', linkToImage);
                    sendResponse({ imageUrl: linkToImage });
                }, 1000);
            }, 1000); // Wait 1 second before starting the check
        }
    }

    // Start the loop
    waitForButtonClick();

    return true; // Indicate that the response is sent asynchronously
});


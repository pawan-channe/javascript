
// Store scraping state
let isScraping = false;

chrome.commands.onCommand.addListener((command) => {
  if (command === "start-scraping") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('instagram.com')) {
        isScraping = !isScraping;
        
        // Use scripting API with error handling
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: toggleScrapingFromBackground,
          args: [isScraping]
        }).then(() => {
          console.log('Script injected successfully');
          chrome.action.openPopup();
        }).catch((error) => {
          console.error('Script injection failed:', error);
        });
      } else {
        console.log('Please navigate to Instagram first');
      }
    });
  }
});

// Function to be injected into the page
function toggleScrapingFromBackground(scrapingState) {
  if (typeof window.instagramScraper !== 'undefined') {
    window.instagramScraper.toggleScraping();
  }
}


class InstagramScraper {
  constructor() {
    this.scrapedData = [];
    this.uniquePosts = new Set();
    this.mountElement = null;
    this.init();
  }

  init() {
    console.log('Instagram Scraper initialized for single post scraping');
    this.refreshMount();
    this.injectStyles();
    this.loadSavedData();
    
    window.instagramScraper = this;

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "getData") {
        sendResponse({data: this.scrapedData});
      }
      if (request.action === "exportData") {
        this.exportData();
        sendResponse({success: true});
      }
      if (request.action === "clearData") {
        this.clearData();
        sendResponse({success: true});
      }
      if (request.action === "scrapeCurrent") {
        this.scrapeCurrentPost().then(success => {
          sendResponse({success: success});
        });
        return true; // Keep message channel open for async response
      }
      return true;
    });

    // Auto-detect if this is a post page
    if (this.isSinglePostPage()) {
      setTimeout(() => {
        this.showStatus('📄 Instagram post page detected', true);
      }, 1000);
    }
  }

  refreshMount() {
    const mount = document.querySelector('[id^="mount_"]');
    // Replace only if missing or disconnected
    if (!this.mountElement || !this.mountElement.isConnected) {
      this.mountElement = mount;
    }
    return this.mountElement;
  }

  getMountId() {
    const mount = this.refreshMount();
    return mount?.id || null;
  }

  isSinglePostPage() {
    const url = window.location.href;
    return url.includes('/p/') || url.includes('/reel/');
  }

  injectStyles() {
    if (document.getElementById('scraper-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'scraper-styles';
    style.textContent = `
      .scraper-status {
        position: fixed;
        top: 10px;
        right: 10px;
        background: #007bff;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        max-width: 300px;
      }
      .scraper-status.success {
        background: #00C851;
      }
      .scraper-status.error {
        background: #ff4444;
      }
      .scraper-status.warning {
        background: #ffbb33;
      }
    `;
    document.head.appendChild(style);
  }

  showStatus(message, isSuccess = false, isWarning = false) {
    let statusDiv = document.getElementById('scraper-status');
    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.id = 'scraper-status';
      statusDiv.className = 'scraper-status';
      document.body.appendChild(statusDiv);
    }
    
    statusDiv.textContent = message;
    if (isSuccess) {
      statusDiv.className = 'scraper-status success';
    } else if (isWarning) {
      statusDiv.className = 'scraper-status warning';
    } else {
      statusDiv.className = 'scraper-status';
    }
    
    setTimeout(() => {
      if (statusDiv && statusDiv.parentNode) {
        statusDiv.remove();
      }
    }, 5000);
  }

  async loadSavedData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['instagramScrapedData'], (result) => {
        if (result.instagramScrapedData) {
          this.scrapedData = result.instagramScrapedData;
          this.uniquePosts.clear();
          this.scrapedData.forEach(post => {
            if (post.uniqueId) this.uniquePosts.add(post.uniqueId);
          });
          console.log('Loaded saved data:', this.scrapedData.length, 'posts');
        }
        resolve();
      });
    });
  }

  async scrapeCurrentPost() {
    if (!this.isSinglePostPage()) {
      this.showStatus('❌ This is not a post page', false);
      return false;
    }

    this.showStatus('🔍 Scraping post data...', false);
    
    return new Promise((resolve) => {
      setTimeout(async () => {
        const postContainer = this.findPostContainer();
        if (postContainer) {
          try {
            const postData = await this.extractPostData(postContainer);
            if (postData) {
              if (this.isNewPost(postData)) {
                this.scrapedData.push(postData);
                this.uniquePosts.add(postData.uniqueId);
                this.saveToStorage();
                this.showStatus(`✅ Post scraped successfully! Total: ${this.scrapedData.length}`, true);
                
                // Send message to update popup counter immediately
                chrome.runtime.sendMessage({
                  action: "updatePopupCounter", 
                  count: this.scrapedData.length
                });
                
                resolve(true);
              } else {
                this.showStatus('⚠️ This post is already in your collection', false, true);
                resolve(false);
              }
            } else {
              this.showStatus('❌ Could not extract post data', false);
              resolve(false);
            }
          } catch (error) {
            console.error('Error scraping post:', error);
            this.showStatus('❌ Error scraping post', false);
            resolve(false);
          }
        } else {
          this.showStatus('❌ No post container found', false);
          resolve(false);
        }
      }, 2000);
    });
  }

  findPostContainer() {
    console.log('🔍 Looking for post container...');
    
    // Try using the XPath pattern
    const mountId = this.getMountId();
    if (mountId) {
      const xpathPattern = `//*[@id="${mountId}"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/div/div[1]/div`;
      
      // Return the post container if found
      try {
        const result = document.evaluate(
          xpathPattern,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        
        if (result.singleNodeValue) {
          console.log('✅ Found post container using XPath pattern');
          return result.singleNodeValue;
        } else {
          console.log('❌ XPath pattern did not find element');
        }
      } catch (error) {
        console.log('❌ XPath error:', error);
      }
    } else {
      console.log('❌ No mount element found');
    }
    
    return null;
  }

  extractCaption() {
    try {
      const mountId = this.getMountId();
      const xpath = `//*[@id="${mountId}"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/div/div[1]/div/div[2]/div/div[2]/div/div[1]/div/div[2]/div/span/div/span`;
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      if (result.singleNodeValue) {
        const text = result.singleNodeValue.textContent?.trim();
        if (text) {
          console.log('✅ Caption extracted via XPath');
          return text;
        }
      }

      console.log('❌ Caption XPath found no text');
      return null;
    } catch (error) {
      console.error('❌ Caption XPath error:', error);
      return null;
    }
  }
  
  async extractPostData(postContainer) {
    try {
      console.log('📝 Starting data extraction from post container...');
      const currentUrl = window.location.href;
      
      const postId = this.extractPostIdFromUrl(currentUrl);
      
      if (!postId) {
        console.log('❌ Could not extract post ID from URL');
        return null;
      }

      // 1. Extract username and profile URL
      const usernameData = this.extractUsername(postContainer);
      if (!usernameData) return null;
      const { username, profileUrl } = usernameData;

      // 2. Extract media
      const rawMediaData = await this.extractAllMedia();
      
      const mediaPost = {
        image: [],
        video: []
      };

      rawMediaData.forEach(item => {
        if (item.type === 'video') {
          mediaPost.video.push(item.src);
        } else {
          mediaPost.image.push(item.src);
        }
      });

      // 3. Extract Meta Data
      const caption = this.extractCaption();
      const likesStr = this.extractLikesWithXPath();
      const commentsStr = this.extractCommentsWithXPath();
      const postTimeData = this.extractPostTime(postContainer);
      
      const formattedPostData = {
        _id: postId,
        datetime: {
          "$date": postTimeData?.datetime || new Date().toISOString()
        },
        interactions: {
          likes: likesStr,
          comments: commentsStr,
          shares: 0, 
          views: 0 
        },
        media_post: mediaPost,
        platform: "INSTAGRAM",
        entity_type: "POST_LINK",
        data_type: "POST_DATA",

        postTimeText: postTimeData?.text || "",
        post_content: caption || "",
        post_link: currentUrl,
        post_owner_link: profileUrl,
        post_owner_name: username,

        processed_datetime: {
          "$date": new Date().toISOString()
        }
      };

      console.log('✅ Successfully extracted post data formatted to schema');
      return formattedPostData;

    } catch (error) {
      console.error('❌ Error extracting post data:', error);
      return null;
    }
  }

  async extractAllMedia() {
    console.log('🔄 Extracting ALL media (images & videos) in sequence...');
    const allMedia = [];
    const processedUrls = new Set();
    
    const mountId = this.getMountId();
    if (!mountId) {
      console.log('❌ No mount element found');
      const genericMedia = this.extractGenericSingleMedia();
      if (genericMedia.length > 0) return genericMedia;
      return allMedia;
    }
    
    // Original Carousel XPath structure (for ul):
    const carouselXPath = `//*[@id="${mountId}"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/div/div[1]/div/div[1]/div/div/div/div/div/div[1]/div/div[1]/div[2]/div/div/div/ul`;
    
    // New Single Post Container XPath (based on user input, targeting the parent div):
    const singlePostContainerXPath = `//*[@id="${mountId}"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/div/div[1]/div/div[1]/div/div/div/div/div/div[1]/div/div/div[1]`;

    // NEW: Single Media Extraction Logic using User's XPath ---
    try {
      const result = document.evaluate(
        singlePostContainerXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      const singleMediaContainer = result.singleNodeValue;
      
      if (singleMediaContainer) {
        console.log('✅ Found single media container using specific XPath');
        
        // Try to find video
        const video = singleMediaContainer.querySelector('video[src]');
        if (video && video.src) {
            allMedia.push({ 
              src: video.src, 
              alt: `Instagram post video 1`, 
              type: 'video' 
            });
            return allMedia;
        }

        // Try to find image (we expect the main one to be in this container)
        const img = singleMediaContainer.querySelector('img[src]');
        if (img && img.src && !img.src.includes('data:image')) {
            allMedia.push({ 
              src: img.src, 
              alt: img.alt || `Instagram post image 1`, 
              type: 'image' 
            });
            return allMedia;
        }
      } else {
        console.log('❌ Single media XPath did not find element, falling back to carousel/general logic.');
      }
    } catch (error) {
        console.log('❌ Error in single media XPath evaluation:', error);
    }

    // Helper: Scrape media item by item to preserve order
    const getVisibleMedia = (xpath) => {
        const results = [];
        try {
            // 1. Get all List Items (li) first to maintain sequence
            const listItems = document.evaluate(
                `${xpath}/li`, 
                document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
            );

            // 2. Iterate through them in DOM order
            for (let i = 0; i < listItems.snapshotLength; i++) {
                const li = listItems.snapshotItem(i);
                
                // CHECK A: Is there a VIDEO in this slide?
                const video = li.querySelector('video');
                if (video && video.src) {
                    results.push({ src: video.src, type: 'video' });
                    continue; 
                }

                // CHECK B: Is there an IMAGE in this slide?
                const img = li.querySelector('img');
                if (img && img.src) {
                    results.push({ src: img.src, type: 'image' });
                }
            }
        } catch (error) {
            console.log('Error getting media from XPath:', error);
        }
        return results;
    };

    // Helper: Process found media and add only new unique items
    const processFoundMedia = () => {
        const foundItems = getVisibleMedia(carouselXPath);
        let newCount = 0;
        
        foundItems.forEach(item => {
            if (item.src && !processedUrls.has(item.src)) {
                processedUrls.add(item.src);
                allMedia.push({
                    src: item.src,
                    alt: `Instagram post ${item.type} ${allMedia.length + 1}`,
                    type: item.type
                });
                newCount++;
            }
        });
        return newCount;
    };

    // Function to check if Next button exists
    const checkNextButton = () => {
        return document.evaluate('//button[@aria-label="Next"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    };

    // Initial check and scrape
    processFoundMedia();
    
    // If we have a next button, start the clicking sequence
    if (checkNextButton()) {
        console.log('Carousel detected - starting click sequence');
        
        const clickNextUntilError = () => {
            return new Promise((resolve) => {
                let clickCount = 0;
                const maxClicks = 50; 
                
                function clickNextWithDelay() {
                    const btn = checkNextButton();
                    
                    if (btn && clickCount < maxClicks) {
                        clickCount++;
                        console.log(`Clicking Next (${clickCount})...`);
                        btn.click();
                        
                        setTimeout(() => {
                            const newFound = processFoundMedia();
                            console.log(`Scanned after click ${clickCount}. New items: ${newFound}`);
                            setTimeout(clickNextWithDelay, 2000);
                        }, 2000);
                    } else {
                        console.log('Finished clicking');
                        processFoundMedia(); // Final safety scan
                        resolve();
                    }
                }
                setTimeout(clickNextWithDelay, 1000);
            });
        };
        
        await clickNextUntilError();
    }
    
    console.log(`✅ Total media collected: ${allMedia.length}`);
    return allMedia;
  }

  extractUsername(container) {
    console.log('🔍 Extracting username...');
    
    // Strategy 1: Look for username in header
    const headerSelectors = [
      'header a[href^="/"]',
      'div[role="button"] a[href^="/"]',
      'a[href^="/"][href*="/"]:first-child',
      'h2 a',
      'div.x1lliihq a[href^="/"]',
      'a[href^="/"][aria-label*="profile"]'
    ];

    for (const selector of headerSelectors) {
      const element = container.querySelector(selector);
      if (element) {
        const href = element.getAttribute('href');
        const text = element.textContent?.trim();
        console.log('Found element with selector:', selector, 'href:', href, 'text:', text);
        
        if (href && href.startsWith('/') && !href.includes('/p/') && !href.includes('/reel/')) {
          const username = href.replace(/\//g, '');
          if (username && username.length > 1) {
            console.log('✅ Found username:', username);
            return {
              username: username,
              profileUrl: `https://www.instagram.com/${username}/`
            };
          }
        }
      }
    }

    // Strategy 2: Look for username in text
    const textElements = container.querySelectorAll('span, a, div');
    for (let el of textElements) {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && !text.includes(' ') && 
          !text.includes('@') && text.length < 30 && 
          /^[a-zA-Z0-9._]+$/.test(text)) {
        
        // Verify it's not a common UI text
        const uiTexts = ['Like', 'Comment', 'Share', 'Save', 'More', 'Follow', 'Send'];
        if (!uiTexts.includes(text)) {
          console.log('✅ Found username in text:', text);
          return {
            username: text,
            profileUrl: `https://www.instagram.com/${text}/`
          };
        }
      }
    }

    console.log('❌ No username found');
    return null;
  }

  extractProfilePicture(container, username) {
    console.log('🔍 Looking for profile picture for username:', username);
    
    // Look for profile pictures near the username
    const profilePicSelectors = [
      // Try to find image near username link
      `a[href="/${username}/"] img`,
      `a[href="/${username}"] img`,
      'header img',
      'div[role="button"] img',
      'div.x1lliihq img',
      // Look for images with profile in alt
      `img[alt*="${username}"]`,
      `img[alt*="${username}'s profile"]`,
      `img[alt*="${username}'s Profile"]`,
      'img[alt*="profile picture"]',
      'img[alt*="Profile Picture"]'
    ];

    for (const selector of profilePicSelectors) {
      const img = container.querySelector(selector);
      if (img) {
        const src = img.src;
        const alt = img.alt || '';
        
        if (src && !src.includes('data:image')) {
          const rect = img.getBoundingClientRect();
          console.log('Found potential profile pic:', {
            selector,
            src: src.substring(0, 80) + '...',
            alt: alt,
            size: `${rect.width}x${rect.height}`
          });
          
          // Profile pictures are usually small (40x40 to 150x150)
          if (rect.width <= 150 && rect.height <= 150) {
            console.log('✅ Found owner profile picture');
            
            return {
              src: src,
              alt: alt || `${username}'s profile picture`,
              type: 'profile_picture'
            };
          }
        }
      }
    }

    // Fallback: Look for any small circular image
    const allImages = container.querySelectorAll('img');
    for (let img of allImages) {
      const src = img.src;
      const alt = img.alt || '';
      
      if (src && !src.includes('data:image')) {
        const rect = img.getBoundingClientRect();
        const isSmall = rect.width <= 150 && rect.height <= 150;
        const isProfilePic = alt.toLowerCase().includes('profile') || 
                            src.includes('150x150') ||
                            src.includes('profile');
        
        if (isSmall && isProfilePic) {
          console.log('✅ Found profile picture (fallback)');
          
          return {
            src: src,
            alt: alt || `${username}'s profile picture`,
            type: 'profile_picture'
          };
        }
      }
    }

    console.log('❌ No profile picture found');
    return null;
  }

  extractLikesWithXPath() {
    console.log('🔍 Extracting likes using XPath...');
  
    const mountId = this.getMountId();
    if (!mountId) {
      console.log('❌ No mount element found for XPath');
      return null;
    }
    
    const likesXPath = `//*[@id="${mountId}"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/div/div[1]/div/div[2]/div/div[3]/section/div[1]/span[2]`;
    
    try {
      const result = document.evaluate(
        likesXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      
      if (result.singleNodeValue) {
        const likesText = result.singleNodeValue.textContent?.trim();
        console.log('✅ Found likes with XPath:', likesText);
        
        // Extract just the number (remove "likes" if present)
        const match = likesText.match(/([\d,\.]+[KkMmBb]?)/);
        if (match && match[1]) {
          return match[1];
        }
        return likesText;
      } else {
        console.log('❌ Likes XPath did not find element');
        return null;
      }
    } catch (error) {
      console.log('❌ XPath error for likes:', error);
      return null;
    }
  }

  extractCommentsWithXPath() {
    console.log('🔍 Extracting comments using XPath...');
    
    const mountId = this.getMountId();
    if (!mountId) {
      console.log('❌ No mount element found for XPath');
      return null;
    }
    
    const commentsXPath = `//*[@id="${mountId}"]/div/div/div[2]/div/div/div[1]/div[1]/div[1]/section/main/div/div[1]/div/div[2]/div/div[3]/section/div[1]/span[4]`;
    
    try {
      const result = document.evaluate(
        commentsXPath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      
      if (result.singleNodeValue) {
        const commentsText = result.singleNodeValue.textContent?.trim();
        console.log('✅ Found comments with XPath:', commentsText);
        
        // Extract just the number (remove "comments" if present)
        const match = commentsText.match(/([\d,\.]+[KkMmBb]?)/);
        if (match && match[1]) {
          return match[1];
        }
        return commentsText;
      } else {
        console.log('❌ Comments XPath did not find element');
        return null;
      }
    } catch (error) {
      console.log('❌ XPath error for comments:', error);
      return null;
    }
  }

  extractPostTime(container) {
    console.log('🔍 Extracting post time...');
    
    const timeElement = container.querySelector('time');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      const text = timeElement.textContent;
      console.log('✅ Found post time:', {datetime, text});
      return {
        datetime: datetime,
        text: text
      };
    }

    const textElements = container.querySelectorAll('span, a');
    for (let el of textElements) {
      const text = el.textContent?.trim();
      if (text && (text.includes('ago') || text.includes('day') || 
                   text.includes('hour') || text.includes('minute') ||
                   text.includes('week') || text.includes('month') ||
                   text.includes('year'))) {
        console.log('✅ Found post time (text):', text);
        return {
          datetime: null,
          text: text
        };
      }
    }

    console.log('❌ No post time found');
    return null;
  }

  extractLocation(container) {
    console.log('🔍 Extracting location...');
    
    const locationSelectors = [
      'a[href*="/explore/locations/"]',
      'span[aria-label*="location"]',
      'div[aria-label*="location"]'
    ];

    for (const selector of locationSelectors) {
      const element = container.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim();
        if (text && text.length > 0) {
          console.log('✅ Found location:', text);
          return text;
        }
      }
    }

    return null;
  }

  extractPostIdFromUrl(url) {
    const matches = url.match(/instagram\.com\/(?:p|reel)\/([^\/?]+)/);
    return matches ? matches[1] : null;
  }

  isNewPost(postData) {
    return !this.uniquePosts.has(postData.uniqueId);
  }

  saveToStorage() {
    chrome.storage.local.set({instagramScrapedData: this.scrapedData}, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
      } else {
        console.log('💾 Data saved to storage:', this.scrapedData.length, 'posts');
        
        chrome.runtime.sendMessage({action: "dataUpdated", count: this.scrapedData.length});
      }
    });
  }

  exportData() {
    if (this.scrapedData.length === 0) {
      alert('No data to export.');
      return;
    }

    const dataStr = JSON.stringify(this.scrapedData, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `instagram_posts_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearData() {
    this.scrapedData = [];
    this.uniquePosts.clear();
    this.saveToStorage();
    this.showStatus('🗑️ All scraped data cleared', true);
    console.log('All scraped data cleared');
  }

  getData() {
    return this.scrapedData;
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new InstagramScraper();
  });
} else {
  new InstagramScraper();
}

/**
 * Elysia Playwright Local Agent Server
 * Run this locally on your machine to grant Elysia real control over your browser!
 * 
 * Setup instructions:
 * 1. Make sure you have Node.js installed.
 * 2. In a clean folder on your local computer, create 'local-agent.js' pasting this content.
 * 3. Run: npm install playwright express cors
 * 4. Run: npx playwright install chromium
 * 5. Launch the server: node local-agent.js
 * 
 * This server binds to port 3001 on localhost, permitting Elysia's web portal to issue
 * real-time Playwright actions directly on your physical computer.
 */

import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();
const PORT = 3001;

app.use(cors({ origin: "*" }));
app.use(express.json());

// Main state references
let browser = null;
let context = null;
let page = null;
let lastActionStatus = "Standing by for connection...";
let logsList = [];

function logAndBroadcast(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const formattedLog = { 
    id: Math.random().toString(), 
    text: `[${timestamp}] ${message}`, 
    type 
  };
  console.log(`[${type.toUpperCase()}] ${message}`);
  logsList.push(formattedLog);
  if (logsList.length > 50) logsList.shift();
  lastActionStatus = message;
}

// Help ensure we have a running browser and active page
async function ensureBrowser() {
  if (!browser) {
    logAndBroadcast("Launching real Chromium headed browser...", "info");
    browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized", "--no-sandbox"]
    });
    context = await browser.newContext({
      viewport: null // Uses natural size
    });
    page = await context.newPage();
    logAndBroadcast("Real Browser window spawned successfully.", "success");
  } else if (!page || page.isClosed()) {
    logAndBroadcast("Re-opening closed page tab...", "info");
    page = await context.newPage();
  }
}

// REST GET API status endpoint
app.get("/api/status", async (req, res) => {
  res.json({
    connected: true,
    browserActive: !!browser,
    lastAction: lastActionStatus,
    logs: logsList,
    currentUrl: page ? page.url() : "None"
  });
});

// REST POST execution endpoint
app.post("/api/action", async (req, res) => {
  const { type, args } = req.body;
  if (!type) {
    return res.status(400).json({ error: "Missing parameter 'type'" });
  }

  logAndBroadcast(`Invoking Local Playwright directive: ${type}`, "action");

  try {
    await ensureBrowser();

    switch (type) {
      case "browserOpen": {
        let destination = args.url || "https://google.com";
        // Contextual convenience mappings
        if (!destination.startsWith("http://") && !destination.startsWith("https://")) {
          if (destination.toLowerCase().includes("youtube") || destination.toLowerCase() === "youtube") {
            destination = "https://youtube.com";
          } else if (destination.toLowerCase().includes("google") || destination.toLowerCase() === "google") {
            destination = "https://google.com";
          } else {
            destination = `https://${destination}`;
          }
        }

        logAndBroadcast(`Navigating real browser to: ${destination}`, "info");
        await page.goto(destination, { waitUntil: "domcontentloaded", timeout: 20000 });
        
        // Auto bypass cookie dialog on YouTube if visible
        if (destination.includes("youtube.com")) {
          try {
            const consentBtn = page.locator('button:has-text("Reject all"), button:has-text("Accept all"), button:has-text("I agree")').first();
            if (await consentBtn.isVisible({ timeout: 1500 })) {
              logAndBroadcast("Intercepted cookie consent box. Dismissing dialog...", "info");
              await consentBtn.click();
            }
          } catch (err) {}
        }

        logAndBroadcast(`Successfully loaded: ${destination}`, "success");
        return res.json({ result: `Opened real browser and landed on ${destination}` });
      }

      case "browserSearch": {
        const query = args.query;
        if (!query) {
          throw new Error("Query parameters missing in action envelope.");
        }

        logAndBroadcast(`Searching for term: "${query}"`, "info");
        const currentUrl = page.url().toLowerCase();

        if (currentUrl.includes("youtube.com")) {
          const ytInput = page.locator('input[id="search"], input[name="search_query"]').first();
          await ytInput.waitFor({ state: "visible", timeout: 5000 });
          await ytInput.fill(query);
          await ytInput.press("Enter");
        } else if (currentUrl.includes("google.com")) {
          const googleInput = page.locator('textarea[name="q"], input[name="q"]').first();
          await googleInput.waitFor({ state: "visible", timeout: 5000 });
          await googleInput.fill(query);
          await googleInput.press("Enter");
        } else {
          // General input heuristic search
          const generalInput = page.locator('input[type="text"], input[type="search"]').first();
          await generalInput.fill(query);
          await generalInput.press("Enter");
        }

        logAndBroadcast(`Search query submitted for: "${query}"`, "success");
        return res.json({ result: `Successfully typed search query "${query}" and triggered event execution.` });
      }

      case "browserClick": {
        const selector = args.selector;
        const desc = args.description || selector;
        if (!selector) {
          throw new Error("Click request omitted mandatory selector path.");
        }

        logAndBroadcast(`Attempting targeted click on: "${desc}"`, "info");

        // Specific high-level YouTube item redirection overrides
        if (selector.startsWith("video-")) {
          const videoId = selector.replace("video-", "");
          const directUrl = `https://www.youtube.com/watch?v=${videoId}`;
          logAndBroadcast(`YouTube direct link matching. Re-routing straight to: ${directUrl}`, "info");
          await page.goto(directUrl, { waitUntil: "domcontentloaded" });
          logAndBroadcast(`Video playback stream opened successfully.`, "success");
          return res.json({ result: `Loaded YouTube stream directly: ${directUrl}` });
        }

        // Standard clicking checks
        let clicked = false;
        
        // Robust YouTube list checking: find link holding matching search labels or items
        if (page.url().includes("youtube.com")) {
          // If trying to click the 'first' index or item from search:
          if (selector === "play-button") {
            await page.evaluate(() => { document.querySelector('video')?.play(); });
            clicked = true;
          } else if (selector === "pause-button") {
            await page.evaluate(() => { document.querySelector('video')?.pause(); });
            clicked = true;
          } else {
            // Find ytd-video-renderer search elements
            const firstResult = page.locator('ytd-video-renderer a#video-title, ytd-rich-grid-media a#video-title').first();
            if (await firstResult.isVisible({ timeout: 2000 })) {
              logAndBroadcast("Identified top organic video card. Executing click...", "info");
              await firstResult.click();
              clicked = true;
            }
          }
        }

        if (!clicked) {
          // Fallback to text matching or direct selector matching
          const textLocator = page.locator(`text="${selector}"`).first();
          if (await textLocator.isVisible({ timeout: 1500 })) {
            await textLocator.click();
            clicked = true;
          } else {
            const selectorLocator = page.locator(selector).first();
            await selectorLocator.click({ timeout: 3000 });
            clicked = true;
          }
        }

        logAndBroadcast(`Successful click completed on target.`, "success");
        return res.json({ result: "Click operation completed successfully." });
      }

      case "browserMediaControl": {
        const action = args.action;
        const val = args.value;
        logAndBroadcast(`Executing real media action: ${action}`, "info");

        let responseText = `Action ${action} completed on player.`;

        if (action === "play") {
          await page.evaluate(() => { document.querySelector('video')?.play(); });
        } else if (action === "pause") {
          await page.evaluate(() => { document.querySelector('video')?.pause(); });
        } else if (action === "volume") {
          const percent = val || 75;
          await page.evaluate((pct) => {
            const v = document.querySelector('video');
            if (v) v.volume = pct / 100;
          }, percent);
          responseText = `Adjusted volume level to ${percent}%`;
        } else if (action === "mute") {
          await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v) v.muted = true;
          });
        } else if (action === "unmute") {
          await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v) v.muted = false;
          });
        } else if (action === "fullscreen") {
          // YouTube native shortcut 'f' is extremely safe and fast
          await page.keyboard.press("f");
          responseText = "Toggled fullscreen view.";
        } else if (action === "exit_fullscreen") {
          await page.evaluate(() => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            }
          });
          responseText = "Exited fullscreen layout.";
        } else if (action === "skip") {
          await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v) v.currentTime += 30;
          });
          responseText = "Skipped forward 30 seconds.";
        } else {
          throw new Error(`Media command action '${action}' unrecognized.`);
        }

        logAndBroadcast(`Media action completed: ${action}`, "success");
        return res.json({ result: responseText });
      }

      case "browserScroll": {
        const direction = args.direction || "down";
        const distance = args.amount || 400;
        const delta = direction === "down" ? distance : -distance;

        logAndBroadcast(`Scrolling document view vertical displacement: ${delta}px`, "info");
        await page.evaluate((yOffset) => {
          window.scrollBy({ top: yOffset, behavior: "smooth" });
        }, delta);

        logAndBroadcast(`Scroll action executed.`, "success");
        return res.json({ result: `Scrolled main layout ${direction} ${distance}px.` });
      }

      case "browserType": {
        const text = args.text;
        if (!text) throw new Error("Missing string 'text' in type container.");
        
        logAndBroadcast(`Typing text into input: "${text}"`, "info");
        await page.keyboard.type(text);
        
        logAndBroadcast(`Finished typing text.`, "success");
        return res.json({ result: `Typed text "${text}" inside the active element.` });
      }

      case "browserGoBack": {
        logAndBroadcast("Navigating back in page history...", "info");
        await page.goBack();
        logAndBroadcast("Returned to previous location.", "success");
        return res.json({ result: "Flashed browser history page back." });
      }

      case "browserTabAction": {
        const subAct = args.action;
        logAndBroadcast(`Browser tab request triggered: ${subAct}`, "info");

        if (subAct === "new") {
          const startUrl = args.url || "https://google.com";
          page = await context.newPage();
          await page.goto(startUrl);
          logAndBroadcast(`New active tab loaded for: ${startUrl}`, "success");
        } else if (subAct === "close") {
          await page.close();
          const pages = context.pages();
          if (pages.length > 0) {
            page = pages[pages.length - 1];
            logAndBroadcast(`Active tab closed. Selected last open tab.`, "success");
          } else {
            page = null;
            logAndBroadcast(`All tabs closed. Waiting for new instructions.`, "info");
          }
        }
        return res.json({ result: `Tab command ${subAct} completed.` });
      }

      default:
        throw new Error(`Directive '${type}' not recognized by Elysia's local Playwright engine.`);
    }

  } catch (err) {
    logAndBroadcast(`Execution error during operation: ${err.message}`, "error");
    res.status(500).json({ error: err.message });
  }
});

// Start Express server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Elysia Playwright Local Agent Server Running!`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});

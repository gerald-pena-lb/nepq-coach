import puppeteer from "puppeteer";

export class MeetBot {
  constructor({ onAudioData, onStatusChange }) {
    this.browser = null;
    this.page = null;
    this.onAudioData = onAudioData;
    this.onStatusChange = onStatusChange;
  }

  async join(meetingUrl) {
    this.onStatusChange("launching", "Launching browser...");

    this.browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--disable-audio-output",
        "--auto-accept-camera-and-microphone-capture",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--window-size=1280,720",
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });

    // Expose function so the page can send audio data back to Node
    await this.page.exposeFunction("onAudioChunk", (base64Audio) => {
      const buffer = Buffer.from(base64Audio, "base64");
      this.onAudioData(buffer);
    });

    this.onStatusChange("navigating", "Opening Google Meet...");

    // Navigate to the meeting
    await this.page.goto(meetingUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for the page to load and handle pre-join screens
    await this._handlePreJoinScreens();

    // Start capturing audio once in the meeting
    await this._startAudioCapture();

    this.onStatusChange("connected", "Connected to meeting and capturing audio");
  }

  async _handlePreJoinScreens() {
    this.onStatusChange("joining", "Handling pre-join screens...");

    try {
      // Wait for page to settle
      await this.page.waitForTimeout(3000);

      // Try to dismiss "Got it" or cookie consent dialogs
      const gotItButtons = await this.page.$$('button');
      for (const button of gotItButtons) {
        const text = await this.page.evaluate(el => el.textContent, button);
        if (text && (text.includes("Got it") || text.includes("Dismiss"))) {
          await button.click();
          await this.page.waitForTimeout(1000);
          break;
        }
      }

      // Turn off camera and microphone before joining
      // Camera button
      try {
        const cameraBtn = await this.page.$('[aria-label*="camera" i], [aria-label*="video" i], [data-is-muted="false"][aria-label*="camera" i]');
        if (cameraBtn) await cameraBtn.click();
      } catch { /* camera already off or not found */ }

      // Microphone button
      try {
        const micBtn = await this.page.$('[aria-label*="microphone" i], [aria-label*="mic" i]');
        if (micBtn) await micBtn.click();
      } catch { /* mic already off or not found */ }

      await this.page.waitForTimeout(1000);

      // Enter name if there's a name input (for non-logged-in users)
      const nameInput = await this.page.$('input[aria-label="Your name"]');
      if (nameInput) {
        await nameInput.click({ clickCount: 3 });
        await nameInput.type("NEPQ Coach (AI Assistant)");
      }

      // Click "Ask to join" or "Join now" button
      const joinClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
        const joinBtn = buttons.find(
          (b) =>
            b.textContent.includes("Join now") ||
            b.textContent.includes("Ask to join") ||
            b.textContent.includes("Join")
        );
        if (joinBtn) {
          joinBtn.click();
          return true;
        }
        return false;
      });

      if (joinClicked) {
        this.onStatusChange("joining", "Clicked join button, waiting to enter meeting...");
      } else {
        this.onStatusChange("warning", "Could not find join button - you may need to admit the bot manually");
      }

      // Wait for the meeting to load (look for the meeting UI)
      await this.page.waitForTimeout(5000);
    } catch (err) {
      this.onStatusChange("warning", `Pre-join handling: ${err.message}`);
    }
  }

  async _startAudioCapture() {
    this.onStatusChange("capturing", "Starting audio capture...");

    await this.page.evaluate(() => {
      // Capture all audio playing in the meeting using AudioContext
      const audioContext = new AudioContext({ sampleRate: 16000 });

      // Get all audio/video elements on the page (other participants' streams)
      const captureAudio = () => {
        const mediaElements = document.querySelectorAll("audio, video");
        const sources = [];

        mediaElements.forEach((el) => {
          if (el.srcObject) {
            try {
              const source = audioContext.createMediaElementSource(el);
              sources.push(source);
            } catch {
              // Element may already be connected
            }
          }
        });

        // Also try to capture via getDisplayMedia streams
        if (sources.length === 0) {
          // Fallback: capture audio from the destination
          console.log("[NEPQ Bot] No media elements found, will retry...");
          return false;
        }

        // Merge all audio sources
        const merger = audioContext.createChannelMerger(sources.length || 1);
        sources.forEach((source, i) => {
          source.connect(merger, 0, Math.min(i, merger.numberOfInputs - 1));
        });

        // Create a ScriptProcessor to extract raw audio data
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        merger.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          // Convert float32 to int16
          const int16Array = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          // Convert to base64 and send to Node
          const uint8Array = new Uint8Array(int16Array.buffer);
          let binary = "";
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          window.onAudioChunk(btoa(binary));
        };

        return true;
      };

      // Retry audio capture as participants join
      let attempts = 0;
      const tryCapture = () => {
        const success = captureAudio();
        if (!success && attempts < 30) {
          attempts++;
          setTimeout(tryCapture, 2000);
        }
      };
      tryCapture();

      // Also set up a MutationObserver to catch new media elements
      const observer = new MutationObserver(() => {
        const newElements = document.querySelectorAll("audio, video");
        if (newElements.length > 0) {
          captureAudio();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  async leave() {
    this.onStatusChange("leaving", "Leaving meeting...");
    try {
      if (this.page) {
        // Click leave button
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button, [role='button']"));
          const leaveBtn = buttons.find(
            (b) =>
              b.textContent.includes("Leave") ||
              b.getAttribute("aria-label")?.includes("Leave")
          );
          if (leaveBtn) leaveBtn.click();
        });
        await this.page.waitForTimeout(1000);
      }
    } catch { /* ignore */ }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    this.onStatusChange("disconnected", "Left the meeting");
  }
}

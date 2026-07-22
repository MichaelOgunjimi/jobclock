# JobClock Chrome Extension

## Install from the Chrome Web Store

[Install JobClock: Job Application Tracker](https://chromewebstore.google.com/detail/jobclock-job-application/albhohoocdlhefihfhiapcmckopbgjhh),
then select **Add to Chrome** and confirm **Add extension**.

## First-time setup

1. Sign in to [JobClock](https://jobclock.michaelogunjimi.com)
2. Generate an extension token under `Settings -> Extension`
3. Open the extension popup
4. Paste the token and select **Connect extension**

The production JobClock URL is built into the extension. The token is stored in
Chrome's local extension storage and can be revoked from JobClock settings.

## Development

To test a local build, open `chrome://extensions`, enable **Developer mode**,
select **Load unpacked**, and choose the `extension/` directory.
It still connects to the production JobClock service; the app URL is not
editable.

## Usage

1. Open any job posting page
2. Open the extension popup
3. Review the extracted preview
4. Save it into your applications

JobClock reads the active page only after you click the extension. Closing and
reopening the popup on the same URL restores the current extraction instead of
starting it again.

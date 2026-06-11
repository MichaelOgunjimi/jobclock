# JobClock Chrome Extension Release Design

**Date:** 2026-06-11
**Status:** Approved
**Branch:** `feat/chrome-extension-release`

## Goal

Prepare the existing Manifest V3 extension for a public Chrome Web Store release.
The extension will use the production JobClock deployment at
`https://jobclock.michaelogunjimi.com`, follow the main application's design
system, satisfy Chrome Web Store privacy and permission requirements, and
produce a validated upload package plus submission materials.

## Product Positioning

**Name:** JobClock: Job Application Tracker

**Single purpose:** Let a signed-in JobClock user preview a job listing from the
active browser tab, save it to their JobClock application pipeline, and update
recent application stages.

The listing and interface must not imply automatic background collection. Page
content is read only after the user opens the extension on a normal HTTP or
HTTPS page.

## User Experience

### First Run

1. The popup explains that the user needs an extension token from JobClock.
2. The production JobClock URL is built into the extension and is not editable.
3. The user pastes the token and selects **Connect JobClock**.
4. The token is stored in `chrome.storage.local`.
5. The popup proceeds to the active-page preview flow.

The setup screen must state:

- the extension connects to `jobclock.michaelogunjimi.com`;
- the token is stored locally in Chrome;
- the token can be revoked from JobClock settings; and
- active-page details are sent to JobClock only when the user opens the
  extension.

### Job Preview And Save

The existing preview, save, recent-applications, stage-update, loading, error,
and restored-state behavior remains intact.

Extraction state is durable across popup closure:

- opening the popup starts extraction only when there is no state for the
  current tab and exact URL;
- closing the popup does not cancel, clear, or restart the active extraction;
- reopening on the same tab and URL restores loading, preview, success, or
  error state without comparing the page title or applying a time-based expiry;
- a reopened popup that restores loading listens for background state changes
  and automatically renders the completed preview or error;
- if a persisted loading state has no matching active background operation, it
  is converted to an interrupted error with a manual retry action;
- navigating the tab to a different URL starts a fresh extraction;
- title-only changes on a dynamic job page do not invalidate state; and
- only explicit **Re-extract** or **Try again** actions clear same-URL state and
  start another request.

User-facing labels will use JobClock consistently:

- **JobClock** instead of **Job Assistant**;
- **Save to JobClock** instead of **Save to applications** where the destination
  needs to be explicit; and
- production-specific connection guidance instead of editable app-URL guidance.

### Settings

The extension's settings action returns to token setup. It must not expose or
allow modification of the production API URL.

## Visual System

The extension popup and all release pages/assets must reuse the web
application's design language:

- IBM Plex Sans for interface copy;
- IBM Plex Serif for display headings;
- white background, near-black foreground, and `#6b2d3c` accent;
- `#e5e5e5` one-pixel borders;
- square corners;
- compact uppercase kickers with wide letter spacing;
- restrained shadows only where the main application already uses them; and
- the existing JobClock logo assets from `public/`.

The release must not introduce beige surfaces, rounded icon tiles, substitute
letter marks, or a separate extension brand.

The popup becomes wider and responsive:

- target a default width of approximately 440 px;
- remain below Chrome's practical popup width limit;
- support a compact layout down to approximately 360 px;
- use the extra width for clearer hierarchy and useful multi-column layouts,
  rather than simply stretching text lines;
- stack job details, controls, and recent-application actions at compact widths;
- prevent horizontal scrolling in every state; and
- keep loading, error, setup, preview, success, and recent states visually
  stable as content length changes.

Text contrast must meet WCAG AA for normal text.

## Architecture And Permissions

### Production Endpoint

The extension uses one constant base URL:

`https://jobclock.michaelogunjimi.com`

All API calls continue to target `/api/jobs/import`.

### Manifest

The production manifest remains Manifest V3 and includes:

- `activeTab`: temporary access to the user-selected tab after extension
  invocation;
- `scripting`: inject the packaged page extractor into that active tab;
- `storage`: retain the extension token and short-lived UI state; and
- exact production host access for
  `https://jobclock.michaelogunjimi.com/*`, required for API requests from the
  extension service worker.

The broad `http://*/*` and `https://*/*` host permissions will be removed.
`activeTab` supplies temporary access to the current page for the user-triggered
extraction flow.

The extension will contain no remotely hosted executable code. All JavaScript
executed by the extension is packaged in the upload ZIP.

### Development

The public package is production-only. Local development may use a separate
ignored development manifest or a documented temporary manifest change, but
localhost permissions and editable server URLs must not ship in the Chrome Web
Store package.

## Data Flow And Privacy

### Data Accessed

On extension invocation, the extension may read:

- active tab URL and title;
- visible or structured job-page content, including job title, company,
  location, salary, and description;
- the user's extension token;
- recent JobClock applications returned by the API; and
- application stage changes explicitly submitted by the user.

### Storage And Transfer

- The extension token and transient popup state are stored in
  `chrome.storage.local`.
- Job-page URL, title, extracted content, and the token are transmitted over
  HTTPS to the JobClock API.
- The API may use the user's configured AI provider to turn page content into a
  structured job preview.
- Job information is persisted to the user's JobClock account only after the
  user selects **Save to JobClock**.
- Data is not sold or used for advertising.

### Public Privacy Policy

Add a public extension privacy page to the deployed web application. It must
accurately explain:

- what data the extension accesses;
- when access occurs;
- how data is used;
- local storage of the token;
- transfer to JobClock and relevant subprocessors or user-configured AI
  providers;
- retention and deletion through the JobClock account;
- token revocation;
- that data is not sold or used for advertising; and
- how to contact the publisher.

The policy must be reachable without authentication and linked from the Chrome
Web Store listing.

### Public Support Page

Add a public extension support page with:

- installation and connection steps;
- token generation and revocation steps;
- supported page expectations;
- LinkedIn loading guidance;
- common authorization, extraction, and network errors;
- privacy-policy link; and
- a support contact route.

## Chrome Web Store Listing

### Listing Copy

Prepare version-controlled listing content containing:

- short description;
- detailed description;
- single-purpose statement;
- permission justifications;
- data-use disclosure guidance;
- setup instructions;
- support URL;
- privacy-policy URL; and
- initial release notes.

The wording must prominently disclose that the extension reads the active job
page only when opened and sends those details to JobClock to preview and save
the role.

### Privacy Dashboard Declarations

The submission checklist must map actual behavior to the Chrome Web Store
privacy fields. At minimum it must call out:

- authentication information, because the personal API token is handled;
- website content, because the active job page is extracted;
- web history or browsing activity where the dashboard classification requires
  it for the active page URL; and
- limited-use certification consistent with the public privacy policy.

The final checkbox selection must be verified against the labels shown in the
Chrome Web Store Developer Dashboard at submission time.

### Artwork

Prepare:

- 128 x 128 store icon;
- three 1280 x 800 full-bleed screenshots showing token connection, job preview,
  and successful save/recent applications;
- 440 x 280 small promotional tile; and
- optional 1400 x 560 marquee tile if it can be produced without delaying the
  required package.

Artwork must use real JobClock assets and realistic extension states. Store
screenshots must represent the shipped user experience and remain readable
when downscaled.

## Packaging

Add a repeatable packaging command that:

1. validates required extension files;
2. validates the manifest and release version;
3. rejects development-only URLs, broad host permissions, and unwanted files;
4. creates a clean versioned ZIP whose root contains `manifest.json`; and
5. writes output to an ignored release-artifact directory.

The release version begins at `0.2.0`.

## Testing

### Automated

- Existing page-extractor tests continue to pass.
- Add focused tests for production configuration and packaging validation.
- Validate that the manifest contains only the intended permissions and host.
- Validate that packaged JavaScript contains no editable or localhost API base
  URL.
- Run lint, relevant unit tests, and a production build.

### Manual

Load the packaged extension unpacked in Chrome and verify:

1. first-run token connection;
2. invalid-token error;
3. extraction from at least one generic job page;
4. LinkedIn extraction after the job description loads;
5. preview and save;
6. recent applications;
7. stage update;
8. restored loading/preview/success states;
9. closing and reopening the popup during extraction does not issue a second
   extraction request;
10. a reopened loading popup updates when the background request completes;
11. title-only page changes preserve same-URL state;
12. an interrupted loading operation becomes a retryable error;
13. token replacement and revocation behavior; and
14. public privacy and support pages on the production-style build.

## Deliverables

- Updated production extension in `extension/`.
- Public extension privacy and support pages.
- Version-controlled Chrome Web Store listing copy and submission checklist.
- Store artwork in a dedicated source-controlled directory.
- Repeatable packaging and validation command.
- Versioned Chrome Web Store upload ZIP.

Uploading the ZIP and pressing the final **Submit for review** control remain
manual account actions unless the user explicitly authorizes browser
interaction with the Chrome Web Store Developer Dashboard.

## Acceptance Criteria

- The popup visibly matches the main JobClock application.
- The popup is wider by default and remains usable without horizontal scrolling
  at compact extension widths.
- Closing and reopening the popup on the same tab URL never restarts extraction
  automatically.
- A same-URL popup restores and follows the existing background operation until
  it reaches preview, success, or error.
- Users enter only an extension token during setup.
- The shipped extension connects only to the production JobClock origin.
- The manifest uses minimum practical permissions.
- Privacy disclosures match the implementation and store dashboard fields.
- Public privacy and support pages are available without authentication.
- Required store artwork and listing copy are complete.
- The versioned ZIP passes package validation and can be loaded in Chrome.
- Relevant tests, lint, and the production build pass.

## Official References

- Chrome Web Store listing requirements:
  <https://developer.chrome.com/docs/webstore/cws-dashboard-listing>
- Chrome Web Store image requirements:
  <https://developer.chrome.com/docs/webstore/images>
- Chrome Web Store privacy policy requirements:
  <https://developer.chrome.com/docs/webstore/program-policies/privacy>
- Chrome Web Store privacy declarations:
  <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>
- Chrome Web Store limited-use policy:
  <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
- Chrome extension permission declarations:
  <https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions>

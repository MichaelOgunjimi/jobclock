# Chrome Web Store Submission Checklist

## Published Listing

JobClock is publicly available in the
[Chrome Web Store](https://chromewebstore.google.com/detail/jobclock-job-application/albhohoocdlhefihfhiapcmckopbgjhh).

Use the remaining checklist when preparing a new version for review.

## Publisher

- [ ] Chrome Web Store developer registration and one-time fee are complete.
- [ ] Developer email is verified and monitored.
- [ ] Publisher name matches the JobClock site and listing.
- [ ] `jobclock.michaelogunjimi.com` is verified in Google Search Console.
- [ ] Official URL/homepage: `https://jobclock.michaelogunjimi.com`.

## Store Listing

- [ ] Name: `JobClock: Job Application Tracker`.
- [ ] Category: Productivity.
- [ ] Language: English (UK).
- [ ] Detailed description matches `extension/store/listing.md`.
- [ ] Support URL:
      `https://jobclock.michaelogunjimi.com/extension/support`.
- [ ] Privacy URL:
      `https://jobclock.michaelogunjimi.com/extension/privacy`.
- [ ] No in-app purchases.
- [ ] Distribution visibility: Public.
- [ ] Listing copy, screenshots, and shipped behavior describe the same features.

## Graphic Assets

- [ ] Store icon: PNG, 128 x 128.
- [ ] At least one screenshot: PNG or JPEG, 1280 x 800; no more than five.
- [ ] Small promo tile: PNG or JPEG, 440 x 280.
- [ ] Marquee promo tile, if supplied: PNG or JPEG, 1400 x 560.
- [ ] Images show the shipping token-only setup and real popup controls.
- [ ] Images contain no unsupported claims, private data, or third-party marks.

## Privacy Practices

Single-purpose text:

> JobClock lets a user preview the active job listing, save it to their JobClock
> application pipeline, and update stages for recent applications.

- [ ] `activeTab` justification explains temporary user-triggered page access.
- [ ] `scripting` justification explains the packaged active-page extractor.
- [ ] `storage` justification explains local token and runtime-state storage.
- [ ] Host justification names only
      `https://jobclock.michaelogunjimi.com/*`.
- [ ] Remote code answer: **No, I am not using remote code**.
- [ ] Authentication information is disclosed because a JobClock extension
      token is stored locally and sent as a bearer token.
- [ ] Website content is disclosed because visible job-listing text is read.
- [ ] Web browsing activity is disclosed because the active page URL/title is
      handled when the user opens the extension.
- [ ] Confirm whether any page content can include user-generated or form data;
      disclose those categories if the final extractor handles them.
- [ ] Disclosure states data is used only for previewing, saving, and managing
      the user's JobClock applications.
- [ ] Disclosure states data is transferred only to JobClock and, where needed
      for the requested preview, the AI provider configured in the user's
      JobClock account.
- [ ] Certify that data is not sold, used for advertising, creditworthiness, or
      unrelated purposes.
- [ ] Certify compliance with the Chrome Web Store Limited Use policy.
- [ ] Privacy dashboard answers exactly match the published privacy page.

## Reviewer Instructions

- [ ] Explain that a JobClock account and extension token are required.
- [ ] Provide a dedicated reviewer test account and token if requested through
      the dashboard's secure test-instructions field.
- [ ] Do not place reusable credentials in public listing text or screenshots.
- [ ] Test flow: open a public job listing, open JobClock, review the preview,
      save it, open Recent, and change its stage.
- [ ] Note that reopening the popup on the same tab and URL restores the active
      or completed operation; **Try again** or **Re-extract** starts a new one.
- [ ] Note that LinkedIn list views require a selected job description to finish
      loading before extraction.

## Package Review

- [ ] Manifest version is 3 and extension version is `0.2.1`.
- [ ] Permissions are exactly `activeTab`, `scripting`, and `storage`.
- [ ] Host permission is exactly
      `https://jobclock.michaelogunjimi.com/*`.
- [ ] No remote scripts, remote fonts, `eval`, source maps, secrets, test files,
      development notes, or generated store artwork are inside the ZIP.
- [ ] Load the final ZIP as an unpacked extension from its extracted directory.
- [ ] Complete setup, preview, popup close/reopen, save, Recent, stage update,
      retry, token revocation, and unauthorized-token smoke tests.
- [ ] Verify privacy and support URLs are public while signed out.
- [ ] Verify every uploaded asset has the required pixel dimensions.
- [ ] Upload the exact validated ZIP produced by the release script.
- [ ] Re-read all dashboard fields after upload and before **Submit for review**.

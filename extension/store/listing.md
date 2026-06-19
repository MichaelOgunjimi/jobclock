# JobClock: Job Application Tracker

## Short Description

Preview and save job listings from any website directly into your JobClock pipeline.

## Single Purpose

JobClock lets a user preview the active job listing, save it to their JobClock
application pipeline, and update stages for recent applications.

## Prominent Data Disclosure

JobClock reads the active job page only when you open the extension. The page
URL, title, and extracted job details are sent securely to your JobClock account
to create a preview. Job details are saved only when you select **Save to
JobClock**. Your JobClock extension token is stored locally in Chrome and can be
revoked from JobClock settings.

## Permission Justifications

### `activeTab`

Provides temporary access to the tab where the user clicks JobClock. The
extension does not read inactive tabs or continuously monitor browsing.

### `scripting`

Injects the packaged JobClock page extractor into the active tab after the user
opens the extension. It reads visible job-listing content needed to create the
preview. No remote code is loaded or executed.

### `storage`

Stores the user's JobClock extension token and the current extraction or save
state locally in Chrome. This lets an in-progress request continue when the
popup closes and restores its result when the popup is reopened on the same URL.

### `https://jobclock.michaelogunjimi.com/*`

Allows the extension to send authenticated preview, save, recent-application,
and stage-update requests only to the production JobClock service. It does not
grant access to arbitrary remote hosts.

## Detailed Description

JobClock turns a job listing in your current tab into a structured application
record without making you copy each field by hand.

Open the extension on a job page to:

- extract the job title, company, location, salary details, apply flow, and
  description from the active page;
- review the structured preview before saving anything;
- save the listing to your personal JobClock application pipeline;
- see recently saved applications and update their stage;
- close and reopen the popup without restarting an extraction on the same tab
  and URL; and
- manually retry or re-extract whenever the page has changed.

The extension connects only to
`https://jobclock.michaelogunjimi.com`. It stores your extension token locally
in Chrome. Active-page details are transmitted over HTTPS to provide the
requested preview and may be processed by the AI provider configured in your
JobClock account. Application data is persisted to your account only when you
select **Save to JobClock**.

JobClock does not sell extension data, use it for advertising, or monitor pages
in the background. You can revoke the extension token at any time in JobClock
settings.

Privacy policy:
https://jobclock.michaelogunjimi.com/extension/privacy

Support:
https://jobclock.michaelogunjimi.com/extension/support

## Release Notes - 0.2.0

- Renamed and restyled the extension for JobClock.
- Added production-only connection and token-only setup.
- Added a wider, responsive popup using the JobClock design system.
- Preserved extraction and save progress when the popup closes.
- Prevented duplicate extraction when reopening on the same tab and URL.
- Added recent application stage updates.
- Reduced host access to the production JobClock domain.


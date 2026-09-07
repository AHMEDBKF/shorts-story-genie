# Kids Short Creator

Build a web application called “Kids Shorts AI”.

The purpose of this application is to automatically create original educational YouTube Shorts for children.

IMPORTANT:

I want the system to be as automated as possible.

I do not need instant video generation.

The system can take hours or even several days to finish generating a video.

The priority is:

Low cost.

Free and open-source tools whenever possible.

Automation.

High-quality original content.

No need for manual editing.

MY WORKFLOW SHOULD BE EXTREMELY SIMPLE:

I should only need to click:

“Create Today’s Short”

or write a simple command such as:

“Create a short story for children about honesty.”

After that, the system should automatically do everything.

VIDEO FORMAT

Create videos specifically for YouTube Shorts:

Vertical format: 9:16

Resolution: 1080x1920

Duration: preferably 30–60 seconds

Educational and entertaining for children

Original content

Arabic language support

Future support for English and other languages

AUTOMATIC AI WORKFLOW

When I click “Create Today’s Short”, the system should automatically:

STEP 1 — SELECT A TOPIC

Choose or generate an educational topic for children.

Examples:

Honesty

Sharing

Cleaning

Numbers

Colors

Animals

Alphabet

Friendship

Safety

Respect

Good habits

The system should check previous videos in the database to avoid repeating the same topic.

STEP 2 — WRITE THE STORY

Automatically generate:

A catchy title.

A short original story.

A strong hook in the first seconds.

Simple language appropriate for children.

A positive educational lesson.

A clear ending.

The story should fit inside 30–60 seconds.

STEP 3 — CREATE SCENES

Automatically divide the story into short scenes.

For every scene generate:

Scene number.

Description.

Characters.

Dialogue.

Narration.

Image generation prompt.

Animation instructions.

Sound effects suggestions.

STEP 4 — GENERATE VISUALS

Prefer low-cost and free/open-source solutions whenever possible.

Generate consistent cartoon images for every scene.

The system should maintain:

The same characters.

The same clothes.

The same visual style.

The same cartoon world.

Create a Character Library where I can define reusable characters.

Each character should contain:

Name.

Personality.

Appearance description.

Clothes.

Reference image.

Visual style.

STEP 5 — GENERATE VOICE

Automatically generate narration and dialogue.

The system should support Arabic voices.

Prefer free or low-cost voice providers.

Create a modular voice provider system so providers can be replaced later.

STEP 6 — AUTOMATIC SHORT VIDEO CREATION

Do NOT require expensive AI video generation for every scene.

Instead, automatically create animated Shorts using:

Generated cartoon images.

Zoom effects.

Pan effects.

Camera movement.

Transitions.

Character movement when possible.

Sound effects.

Background music.

Automatic subtitles.

Use FFmpeg or another open-source video rendering system.

The final result must look dynamic and engaging for children.

STEP 7 — AUTOMATIC QUALITY CHECK

Before publishing, automatically check:

Video duration.

Vertical 9:16 format.

Audio exists.

Subtitles exist.

No empty scenes.

No repeated scene.

No generation errors.

If an error occurs, retry the failed generation step automatically.

STEP 8 — YOUTUBE SHORTS

Integrate with the official YouTube API using OAuth.

Allow me to connect my own YouTube channel securely.

Automatically generate:

Title.

Description.

Relevant metadata.

The system should allow:

Save as Private.

Upload as Unlisted.

Publish automatically.

Default mode should be:

Upload as Private.

STEP 9 — FULL AUTOMATION

Create an Automation Scheduler.

Example:

Every week, automatically:

Generate one new educational children's Short.

Generate the story.

Generate scenes.

Generate visuals.

Generate voices.

Create the video.

Generate title and description.

Upload the finished video to YouTube as Private.

The generation process can take hours or days.

The system must use a background job queue and persist job status so generation can continue even if the user closes the browser.

AI PROVIDER SYSTEM

Create a modular AI Provider Router.

Support separate providers for:

Text generation.

Image generation.

Voice generation.

Music generation.

Do not depend on a single AI provider.

The system should allow adding new providers later.

Use fallback logic:

If Provider A fails → retry with Provider B.

However, do not bypass API limits, authentication, subscriptions, quotas, or provider terms of service.

LOW COST MODE

Create a “Low Cost Mode”.

When enabled:

Prefer free-tier providers that I have legally configured.

Prefer open-source tools.

Avoid expensive AI video generation.

Use image animation instead of full AI video.

Use FFmpeg for final rendering.

Allow jobs to wait for available quotas instead of failing.

Continue pending jobs later.

The system should never secretly use a paid provider.

If a provider requires payment, ask for explicit configuration and approval before using it.

DATABASE AND BACKEND

Use Supabase.

Create tables for:

Users.

Characters.

Topics.

Stories.

Scenes.

Generated images.

Audio files.

Videos.

Production jobs.

Failed jobs.

AI providers.

YouTube publishing history.

Automation schedules.

Use Supabase Storage for media files.

API keys must never be exposed to the frontend.

Use secure server-side secrets or Supabase Edge Functions for sensitive API calls.

DASHBOARD

Create a simple Arabic-friendly dashboard.

The main dashboard should include:

A large button:

“إنشاء فيديو هذا الأسبوع”

Also display:

Current production progress.

Current job status.

Pending generation tasks.

Completed videos.

Failed tasks.

AI provider status.

YouTube upload status.

MOST IMPORTANT USER EXPERIENCE

My ideal workflow is:

I open the application.

I click:

“إنشاء فيديو هذا الأسبوع”

Then I can close the application.

The system continues working in the background.

Later, I return and find the finished YouTube Short uploaded as Private to my connected YouTube channel.

Build the application architecture to support this workflow first.

Start by building the database, authentication, dashboard, background job system, production pipeline, provider abstraction layer, and YouTube OAuth integration.

Use mock providers for AI services until I configure real API keys.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://shorts-story-genie.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3b512f28-6bb3-4025-85c6-6be4d16bd44f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

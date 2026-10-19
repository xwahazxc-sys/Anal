# Lenny's Scam Lab — runbook (channel run by Claude)

Owner handed the channel over (Oct 19, 2026): Claude decides what goes out and when, makes new videos
when the stock runs out, and sends a report in Russian every Saturday (routine "Lenny's Scam Lab — weekly report").

## Release rhythm
- Long episodes: Tue & Fri 12:00 US Eastern (matches the banner "New videos every Tue & Fri").
- Shorts: the day after their episode, 15:00 ET; Related video → that episode (needs channel verification).
- Never set "Altered or synthetic content" (owner's decision; content is clearly animated).
- Titles: ≤7 words, one concrete object, "Don't …" warning or a consequence mystery (see publish/published.md).
- Country of residence: United States (owner's choice).

## Uploading
GitHub Actions workflow `.github/workflows/yt-upload.yml` (secrets YT_COOKIES, YT_PROXY set by the owner).
Trigger with `ids`, ONE run at a time (GitHub cancels extra pending runs):
- `ep05` upload + schedule from publish/queue.json · `ep05:private` private test
- `s1@VIDEOID` reschedule an uploaded video · `noai=VIDEOID` set altered content to No
- `related=SHORTID:ep04` Related video · `country` · `audit` read-only screenshots
Daily upload limit ~9–10 for an unverified channel; rescheduling doesn't count.

## Stock (Oct 19)
Ready: ep02, ep03, ep04 (HQ parts in videos/cinematic/hq), 8 Shorts (all uploaded & scheduled).
To render: ep05 (1/9 chunks), ep06, ep07, ep08 — kit in youtube/lenny/motion/.
After ep08: write new episodes (yt-script), voice with ElevenLabs Lenny voice, images via Kaggle Qwen, render with the kit.

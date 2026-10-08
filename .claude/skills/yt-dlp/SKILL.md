---
name: yt-dlp
description: >-
  Download video/audio, subtitles, thumbnails and metadata from YouTube and
  other sites with yt-dlp. Use for "download this video", "get the transcript
  or subtitles", "extract audio", "list formats", or a pasted video URL.
---

# yt-dlp

Wrapper skill for the [yt-dlp](https://github.com/yt-dlp/yt-dlp) CLI.

## Setup

If `yt-dlp --version` fails: `pip install -U "yt-dlp[default]"` (ffmpeg is needed for merging/audio extraction).

Always pass `--js-runtimes node` (deno is not installed here; without a JS runtime YouTube formats go missing).

## What works in the cloud sandbox

- Metadata, format lists, subtitles/auto-subs: work without login.
- Video/audio file downloads: YouTube answers `Sign in to confirm you're not a bot` / HTTP 403
  for datacenter IPs. Needs the user's cookies: ask them to export `cookies.txt` from a logged-in
  browser (see https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies), save it
  outside the repo, and pass `--cookies /path/cookies.txt`. Never commit cookies.

## Common recipes

```bash
yt-dlp -F URL                                   # list formats
yt-dlp -f "bv*+ba/b" URL                        # best video+audio
yt-dlp -x --audio-format mp3 URL                # audio only
yt-dlp --write-auto-subs --sub-langs en --skip-download --convert-subs srt URL   # transcript for yt-chapters / yt-edit
yt-dlp --dump-json --skip-download URL          # metadata only
yt-dlp -o "%(title)s [%(id)s].%(ext)s" URL      # output template
```

## Rules

- Always put downloads in a dedicated directory, not the repo root.
- Only download content the user has the right to download.
- On HTTP 403 / extraction errors, first run `pip install -U yt-dlp` - sites change often.
- Report the output file path when done.

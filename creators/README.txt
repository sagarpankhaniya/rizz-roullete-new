RIZZ ROULETTE — CREATOR PAGES BUNDLE
====================================

WHAT'S INSIDE
-------------
index.html ................. Creators cover page. Grid of all 13 creators,
                             each card links to that creator's profile page.
                             Start here.

13 creator profile pages:
  lily-rizzroulette-final.html
  lusia-rizzroulette.html
  bella-rizzroulette.html
  pamela-nicoli-rizzroulette.html
  valarie-spice-rizzroulette.html
  valentina-rizzroulette.html
  hana-sophia-rizzroulette.html
  eliesha-rizzroulette.html
  elma-redhoneylux-rizzroulette.html
  kaylov-rizzroulette.html
  alejandra-rizzroulette.html
  bong-vixen-rizzroulette.html
  divina-rizzroulette.html

instagram-posts/ ........... 9 Instagram posters (1080x1350, 4:5 portrait)
                             for the first 9 creators. Kaylov, Alejandra,
                             The Bong Vixen and Divina do not have posters yet.

LilyCreatorPage.jsx ........ React component version of Lily's page
                             (default export, no props needed).


IMPORTANT — KEEP FILES TOGETHER
-------------------------------
The index links to profiles by relative filename. All .html files must stay
in the SAME folder or the links will break. Open index.html to test.

Every page is fully self-contained: photos and the logo are embedded as
base64, so there are no external image files to upload or lose.


TO DEPLOY WITH CLEAN URLS
-------------------------
If you want /creators/lily/ style paths instead of raw filenames, rename the
files and update the href values inside index.html to match. Search for
'class="card reveal" href=' to find all 13 links in one place.


STILL TO WIRE UP
----------------
- "SPIN INTO HER ROOM" and "SEND A TIP" buttons are placeholders on every
  page. Point them at your room-join and tipping endpoints.
- The live status line on each page is static text ("goes live after dark",
  etc). Replace with your real online-status data if you have it.
- Valarie Spice's page has a working Fansly link; no other external links
  are set.

18+ / COMPLIANCE
----------------
Every page carries an RTA meta label, an 18+ badge, and "all creators
verified 18+" in the footer. Make sure your documented age-verification
records (ID checks) back that claim up before going live.

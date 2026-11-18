# Workstream 2: Visualiser ("see it on your furniture")

## Goal
Customers can easily see how chosen doors would look on their own cabinets or furniture, from a photo they take. It doesn't need to be fully inside the website, but it must be easy.

## Status (18 Nov 2026)
Not started.

## Agreed approach (two steps)
1. **Overlay, no AI, built first.** The customer uploads a photo and drags four corner handles onto each door in the photo. The site warps the exact door drawing from the engine onto it (a perspective transform on a canvas). It's free to run and instant, the pattern is always accurate, and the photo can stay on the customer's device. Finishes: raw MDF, plus a few paint colours.
2. **AI-assisted render, later.** The photo and chosen door are sent to an image-editing AI for a realistic result. It costs pence per image, needs a privacy notice and consent, and can change details, so it must be labelled as an impression. A cheaper middle option is a "copy prompt and door image" button the customer pastes into ChatGPT or Gemini themselves.

## Open questions for Tim
- Where it appears: inside the configurator ("See it in your room"), a separate page, or both.
- Which paint colours to offer as previews.
- Budget for AI image calls, if step 2 goes ahead.

## Next tasks
1. Prototype the overlay: upload, 4-point placement for each door, choose design and finish, and download the result as an image.
2. Connect it to the configurator's current door list.
3. Mobile first: most people will take the photo on a phone.
4. Look into image-editing APIs for step 2 (cost, quality, data handling) and recommend one.

## Key files (expected)
`public/js/engine.js` (`doorSVG` draws the door), new `public/visualise.html` + `public/js/visualise.js`.

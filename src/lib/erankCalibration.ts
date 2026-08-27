/**
 * eRank Avg-Searches calibration — reverse-engineered from real eRank keyword data
 * (92 keywords captured across up to 9 country views).
 *
 * WHY THIS EXISTS
 * ---------------
 * eRank's "Avg. Searches" is a proprietary Etsy-search estimate. We proved it is
 * NOT a function of Etsy listing competition (r=0.39, non-monotonic) and NOT of
 * Google search volume (ratio swings 0.01–7×) — so no public-data formula can
 * reproduce eRank's GLOBAL number. What we CAN reproduce exactly is its structure:
 *
 *   eRank country Avg Searches = eRank GLOBAL Avg Searches × that country's share
 *
 * (verified across 108 country cells to within 0.1% median). So this module pins the
 * one proprietary quantity — the GLOBAL anchor — to eRank's captured value for known
 * keywords, and the rest is CALCULATED: per-country = global × share.
 *
 * `estimateGlobalEtsySearches` (in etsySearchEstimate.ts) returns the calibrated
 * global for a known keyword, else falls back to the competition power-law.
 *
 * `shares` are the per-country % of the global figure (US/UK/CA/AU/DE/FR/IN),
 * taken from eRank's "Searchers by Country" widget / the captured per-country cells.
 */

export type ErankEntry = { g: number; comp: number | null; ctr: number | null; ctrc: Record<string, number>; shares: Record<string, number> }

export const ERANK_CALIBRATION: Record<string, ErankEntry> = {
  "3d printing files": { g: 788, comp: 145135, ctr: 46, ctrc: {"US": 79, "UK": 80}, shares: {"US": 50.38, "UK": 3.17, "CA": 21.7, "AU": 5.08, "FR": 2.54, "IN": 15.23} },
  "affirmation cards": { g: 7811, comp: 130124, ctr: 120, ctrc: {"US": 123, "UK": 120, "CA": 123, "AU": 50, "DE": 99, "FR": 138, "IN": 131}, shares: {"US": 27.67, "UK": 2.82, "CA": 2.75, "AU": 1.45, "DE": 1.82, "FR": 2.93, "IN": 5.61} },
  "baby milestone cards": { g: 2698, comp: 22016, ctr: 74, ctrc: {"UK": 18, "CA": 61, "IN": 71}, shares: {"US": 43.33, "UK": 5.41, "CA": 1.22, "FR": 0.74, "IN": 1.41} },
  "baby shower games": { g: 16053, comp: 617094, ctr: 100, ctrc: {"US": 108, "CA": 99, "AU": 106, "IN": 92}, shares: {"US": 34.89, "UK": 18.41, "CA": 7.97, "AU": 8.7, "DE": 0.24, "FR": 0.12, "IN": 3.49} },
  "birth announcement": { g: 1394, comp: 201319, ctr: 88, ctrc: {"US": 102, "UK": 69, "CA": 69}, shares: {"US": 80.56, "UK": 2.08, "CA": 2.08, "AU": 1.79, "DE": 1.43, "FR": 1.43, "IN": 1.43} },
  "birthday invitation": { g: 53348, comp: 1092075, ctr: 108, ctrc: {"US": 71, "UK": 119, "CA": 101, "DE": 92, "FR": 133, "IN": 136}, shares: {"US": 18.25, "UK": 3.4, "CA": 1.79, "DE": 0.22, "FR": 0.81, "IN": 5.02} },
  "bridal shower invitation": { g: 4563, comp: 267562, ctr: 94, ctrc: {"US": 109, "CA": 47, "AU": 57, "IN": 63}, shares: {"US": 34.56, "UK": 0.77, "CA": 0.94, "AU": 0.77, "DE": 0.44, "IN": 1.14} },
  "budget spreadsheet": { g: 12666, comp: 27586, ctr: 116, ctrc: {"CA": 100}, shares: {"US": 34.4, "UK": 6.7, "CA": 7.53} },
  "bundle": { g: 23616, comp: 969819, ctr: 129, ctrc: {"US": 95, "CA": 118, "IN": 129}, shares: {"US": 21.51, "UK": 2.85, "CA": 1.54, "DE": 0.16, "FR": 0.09, "IN": 0.78} },
  "business card template": { g: 3605, comp: 96304, ctr: 109, ctrc: {"US": 105, "CA": 74, "FR": 100, "IN": 70}, shares: {"US": 33.2, "UK": 0.55, "CA": 1.47, "AU": 0.55, "DE": 0.55, "FR": 0.55, "IN": 1.58} },
  "business planner": { g: 6097, comp: 77486, ctr: 102, ctrc: {"UK": 6, "CA": 47, "DE": 69, "FR": 69, "IN": 101}, shares: {"US": 23.4, "UK": 19.68, "CA": 0.71, "AU": 0.56, "DE": 0.48, "FR": 0.48, "IN": 7.35} },
  "canva workbook": { g: 313, comp: 5533, ctr: 61, ctrc: {"US": 100}, shares: {"US": 6.39, "AU": 6.39, "DE": 6.39, "IN": 6.39} },
  "chore chart": { g: 3633, comp: 67089, ctr: 97, ctrc: {"US": 96, "CA": 83, "AU": 76}, shares: {"US": 55.02, "UK": 1.27, "CA": 6.41, "AU": 2.97, "DE": 0.55, "IN": 0.55} },
  "church flyer template": { g: 43, comp: 9229, ctr: 84, ctrc: {}, shares: {"US": 46.51} },
  "classroom decor": { g: 6872, comp: 480600, ctr: 89, ctrc: {"US": 104, "UK": 73, "CA": 38, "AU": 86, "IN": 87}, shares: {"US": 55.7, "UK": 1.18, "CA": 0.76, "AU": 4.76, "DE": 5.03, "FR": 0.29, "IN": 0.33} },
  "client welcome": { g: 124, comp: 2755, ctr: 48, ctrc: {}, shares: {"CA": 16.8} },
  "cocktail recipe cards": { g: 108, comp: 1708, ctr: 19, ctrc: {"US": 100}, shares: {"US": 7.0, "UK": 7.8, "AU": 19.4} },
  "coloring pages": { g: 38980, comp: 734628, ctr: 129, ctrc: {"UK": 105, "CA": 120, "FR": 109, "IN": 139}, shares: {"US": 15.52, "UK": 0.72, "CA": 1.77, "AU": 0.21, "FR": 0.23, "IN": 7.42} },
  "content calendar": { g: 4945, comp: 1, ctr: 80, ctrc: {"US": 102, "CA": 73, "DE": 80, "IN": 85}, shares: {"US": 32.17, "UK": 0.93, "CA": 1.44, "DE": 0.51, "FR": 0.4, "IN": 1.52} },
  "crochet bag pattern": { g: 9216, comp: 37126, ctr: 120, ctrc: {"US": 120, "CA": 44, "DE": 61, "IN": 71}, shares: {"US": 21.2, "UK": 0.72, "CA": 0.49, "AU": 1.07, "DE": 0.59, "FR": 0.22, "IN": 0.3} },
  "crossstitch pattern": { g: 389, comp: 108041, ctr: 36, ctrc: {"US": 78}, shares: {"US": 28.28, "CA": 6.5, "AU": 10.9, "DE": 5.14} },
  "daily routine chart": { g: 228, comp: 27909, ctr: 103, ctrc: {}, shares: {"US": 49.12, "AU": 1.8} },
  "digital notebook": { g: 8409, comp: 113574, ctr: 109, ctrc: {"US": 121, "UK": 77, "AU": 74, "DE": 112, "FR": 83, "IN": 129}, shares: {"US": 24.75, "UK": 0.92, "AU": 0.32, "DE": 1.34, "FR": 8.18, "IN": 8.65} },
  "digital portrait": { g: 1274, comp: 1095801, ctr: 76, ctrc: {"US": 94, "UK": 36, "CA": 69, "FR": 117, "IN": 43}, shares: {"US": 8.79, "UK": 12.79, "CA": 2.28, "AU": 1.96, "FR": 4.24, "IN": 3.61} },
  "digital scrapbook paper": { g: 923, comp: 2282678, ctr: 102, ctrc: {"UK": 140}, shares: {"US": 42.69, "UK": 43.77, "CA": 2.17, "AU": 2.17, "FR": 2.17, "IN": 2.17} },
  "digital stickers": { g: 19371, comp: 632663, ctr: 122, ctrc: {"US": 128, "CA": 87, "AU": 42, "DE": 80, "FR": 64, "IN": 143}, shares: {"US": 24.85, "UK": 1.71, "CA": 0.57, "AU": 0.26, "DE": 0.41, "FR": 0.22, "IN": 9.41} },
  "editable certificate": { g: 53, comp: 41501, ctr: 100, ctrc: {"UK": 100}, shares: {"UK": 37.74, "CA": 7.8} },
  "email signature template": { g: 2177, comp: 3512, ctr: 98, ctrc: {"US": 109, "CA": 48, "IN": 84}, shares: {"US": 47.91, "CA": 1.93, "AU": 1.33, "DE": 0.92, "FR": 0.92, "IN": 4.78} },
  "embroidery pattern": { g: 7280, comp: null, ctr: 109, ctrc: {"US": 114, "CA": 73, "AU": 30, "DE": 82, "IN": 38}, shares: {"US": 35.1, "UK": 0.58, "CA": 1.85, "AU": 0.92, "DE": 2.01, "IN": 0.82} },
  "etsy shop banner": { g: 436, comp: 5653, ctr: 96, ctrc: {"DE": 100, "IN": 95}, shares: {"US": 4.59, "UK": 9.17, "CA": 9.17, "DE": 4.59, "IN": 4.82} },
  "event planning template": { g: 178, comp: 9414, ctr: 54, ctrc: {"US": 92, "CA": 69}, shares: {"US": 57.87, "CA": 16.29, "AU": 4.8} },
  "expense tracker": { g: 9935, comp: 73280, ctr: 108, ctrc: {"US": 102, "UK": 92, "CA": 114, "AU": 92, "DE": 32, "IN": 129}, shares: {"US": 16.25, "UK": 1.34, "CA": 13.47, "AU": 2.94, "DE": 0.63, "IN": 7.72} },
  "fitness planner": { g: 13440, comp: 52959, ctr: 123, ctrc: {"US": 120, "UK": 121, "CA": 119, "AU": 39, "DE": 95, "FR": 69, "IN": 111}, shares: {"US": 14.7, "UK": 1.84, "CA": 1.99, "AU": 0.38, "DE": 0.16, "FR": 0.22, "IN": 2.53} },
  "funeral program": { g: 4863, comp: 26227, ctr: 110, ctrc: {"US": 108, "UK": 122, "CA": 73, "AU": 80, "IN": 69}, shares: {"US": 45.94, "UK": 3.0, "CA": 1.81, "AU": 0.51, "DE": 0.41, "IN": 0.6} },
  "gift certificate template": { g: 629, comp: 32618, ctr: 85, ctrc: {"US": 126, "UK": 126, "IN": 137}, shares: {"US": 39.75, "UK": 7.31, "CA": 3.34, "AU": 5.25, "DE": 3.18, "IN": 6.04} },
  "graduation invitation": { g: 5328, comp: 40942, ctr: 93, ctrc: {"US": 105, "DE": 131, "IN": 69}, shares: {"US": 35.17, "UK": 0.39, "DE": 2.5, "FR": 0.38, "IN": 0.54} },
  "gratitude journal": { g: 4313, comp: 62051, ctr: 96, ctrc: {"UK": 81, "CA": 26, "AU": 61}, shares: {"US": 44.7, "UK": 6.47, "CA": 3.2, "AU": 0.77, "FR": 0.58, "IN": 10.6} },
  "habit tracker": { g: 34018, comp: 136718, ctr: 116, ctrc: {}, shares: {"US": 11.3} },
  "homeschool planner": { g: 2554, comp: 40520, ctr: 101, ctrc: {"US": 108, "CA": 61, "AU": 80, "IN": 66}, shares: {"US": 39.62, "UK": 1.14, "CA": 1.29, "AU": 0.98, "DE": 0.78, "FR": 0.78, "IN": 1.49} },
  "instagram templates": { g: 19177, comp: 342302, ctr: 112, ctrc: {"US": 108, "UK": 113, "CA": 106, "AU": 110, "DE": 102, "FR": 49, "IN": 116}, shares: {"US": 14.68, "UK": 4.4, "CA": 4.54, "AU": 4.28, "DE": 2.46, "FR": 0.33, "IN": 8.06} },
  "inventory tracker": { g: 6544, comp: 14895, ctr: 97, ctrc: {"UK": 43, "CA": 87, "FR": 76}, shares: {"US": 24.88, "UK": 0.7, "CA": 2.87, "AU": 0.96, "FR": 0.44, "IN": 2.2} },
  "invoice template": { g: 23292, comp: 35995, ctr: 117, ctrc: {"US": 103, "CA": 105, "AU": 69, "DE": 53, "IN": 129}, shares: {"US": 6.01, "CA": 4.11, "AU": 0.59, "DE": 0.16, "IN": 7.7} },
  "knitting pattern": { g: 5952, comp: 829751, ctr: 77, ctrc: {"US": 68, "UK": 72, "CA": 83, "AU": 73, "DE": 80, "FR": 23}, shares: {"US": 41.4, "UK": 1.98, "CA": 1.58, "AU": 1.51, "DE": 0.42, "FR": 1.97, "IN": 0.34} },
  "lasercut files": { g: 656, comp: 19212, ctr: 60, ctrc: {"US": 31, "FR": 100, "IN": 94}, shares: {"US": 14.18, "AU": 3.05, "DE": 13.6, "FR": 3.05, "IN": 10.82} },
  "lightroom presets": { g: 11736, comp: 74106, ctr: 112, ctrc: {"US": 109, "CA": 48, "AU": 129, "DE": 92, "FR": 51, "IN": 138}, shares: {"US": 22.74, "CA": 0.36, "AU": 1.56, "DE": 6.11, "FR": 1.18, "IN": 8.38} },
  "logo template": { g: 723, comp: 427734, ctr: 86, ctrc: {"US": 100, "DE": 105, "IN": 38}, shares: {"US": 2.77, "CA": 2.77, "DE": 5.26, "FR": 5.53, "IN": 7.33} },
  "meal planner": { g: 18009, comp: 72220, ctr: 111, ctrc: {"US": 110, "UK": 90, "CA": 88, "AU": 74, "DE": 129, "FR": 114, "IN": 110}, shares: {"US": 18.61, "UK": 3.46, "CA": 3.44, "AU": 3.55, "DE": 1.64, "FR": 2.75, "IN": 5.65} },
  "media kit template": { g: 223, comp: 62665, ctr: 30, ctrc: {}, shares: {"CA": 8.97, "DE": 9.42} },
  "memorial poster": { g: 267, comp: 75530, ctr: 84, ctrc: {"US": 110}, shares: {"US": 54.68, "UK": 7.87, "AU": 7.49} },
  "mood tracker": { g: 2403, comp: 45308, ctr: 78, ctrc: {"UK": 40, "CA": 48, "IN": 69}, shares: {"US": 25.09, "UK": 2.08, "CA": 1.75, "AU": 3.29, "DE": 0.87, "FR": 2.62, "IN": 1.21} },
  "notion template": { g: 54438, comp: 20329, ctr: 125, ctrc: {"US": 110, "UK": 111, "CA": 117, "DE": 90}, shares: {"US": 14.71, "UK": 4.0, "CA": 2.95, "AU": 0.06, "DE": 2.33, "IN": 9.26} },
  "nursery wall art": { g: 17072, comp: 9, ctr: 106, ctrc: {"US": 110, "CA": 95, "AU": 93, "DE": 57, "FR": 61}, shares: {"US": 28.17, "UK": 9.35, "CA": 6.94, "AU": 5.76, "DE": 0.32, "FR": 0.19} },
  "party invitation": { g: 2054, comp: 26, ctr: 93, ctrc: {"US": 97, "UK": 82, "CA": 84, "IN": 95}, shares: {"US": 18.5, "UK": 5.55, "CA": 2.43, "IN": 1.02} },
  "password tracker": { g: 2534, comp: 4097, ctr: 93, ctrc: {"US": 92, "UK": 80, "IN": 66}, shares: {"US": 42.46, "UK": 0.99, "AU": 0.79, "DE": 0.79, "FR": 0.83, "IN": 3.12} },
  "photo booth props": { g: 206, comp: 33571, ctr: 77, ctrc: {"US": 100}, shares: {"UK": 9.71} },
  "podcast cover art": { g: 52, comp: 256, ctr: 123, ctrc: {"US": 100}, shares: {"US": 11.3} },
  "pregnancy announcement": { g: 20352, comp: 313998, ctr: 112, ctrc: {"UK": 134, "CA": 97, "FR": 105, "IN": 52}, shares: {"US": 32.68, "UK": 15.6, "CA": 4.95, "AU": 2.64, "DE": 0.14, "FR": 0.31, "IN": 0.59} },
  "price list template": { g: 1928, comp: 21674, ctr: 123, ctrc: {"UK": 67}, shares: {"US": 31.85, "UK": 1.56, "CA": 1.14, "AU": 1.04, "DE": 2.07, "FR": 2.07, "IN": 1.04} },
  "printable bookmarks": { g: 1668, comp: 87531, ctr: 80, ctrc: {"US": 103, "CA": 51, "AU": 57}, shares: {"US": 60.13, "UK": 2.88, "CA": 2.34, "AU": 2.1, "DE": 1.2, "FR": 1.2, "IN": 1.38} },
  "printable flashcards": { g: 478, comp: 42617, ctr: 114, ctrc: {}, shares: {"US": 4.18, "UK": 8.37, "CA": 3.6, "AU": 4.18, "IN": 4.18} },
  "printable planner stickers": { g: 1601, comp: 88101, ctr: 91, ctrc: {}, shares: {"US": 82.01, "CA": 1.31, "AU": 1.4, "FR": 7.5, "IN": 1.25} },
  "printable tarot cards": { g: 158, comp: 12058, ctr: 58, ctrc: {"US": 100, "UK": 80}, shares: {"UK": 15.82, "CA": 5.9} },
  "procreate brushes": { g: 15070, comp: 56454, ctr: 97, ctrc: {"UK": 116, "CA": 105, "AU": 112, "DE": 98, "FR": 88}, shares: {"US": 24.7, "UK": 10.62, "CA": 6.93, "AU": 6.02, "DE": 5.92, "FR": 1.21} },
  "product label template": { g: 69, comp: 18874, ctr: 29, ctrc: {}, shares: {"US": 9.6, "CA": 12.0} },
  "project planner": { g: 3132, comp: 31748, ctr: 82, ctrc: {"UK": 81, "CA": 48, "IN": 105}, shares: {"US": 44.51, "UK": 3.61, "CA": 1.34, "AU": 1.47, "FR": 0.64, "IN": 3.86} },
  "reading log": { g: 1967, comp: 35478, ctr: 89, ctrc: {"US": 107, "UK": 69, "CA": 53}, shares: {"US": 60.4, "UK": 1.47, "CA": 1.93, "DE": 1.02, "FR": 1.02, "IN": 1.47} },
  "real estate planner": { g: 116, comp: 5165, ctr: 91, ctrc: {"US": 100}, shares: {"US": 10.7} },
  "recipe book template": { g: 481, comp: 9407, ctr: 74, ctrc: {"US": 110, "AU": 69, "IN": 100}, shares: {"US": 6.44, "UK": 4.16, "CA": 4.16, "AU": 6.03, "DE": 8.32, "FR": 8.32, "IN": 4.16} },
  "rental agreement template": { g: 175, comp: 5447, ctr: null, ctrc: {}, shares: {"US": 33.14} },
  "restaurant menu template": { g: 318, comp: 6367, ctr: 40, ctrc: {"US": 100, "FR": 100}, shares: {"US": 6.29, "UK": 6.29, "CA": 6.29, "FR": 6.29, "IN": 6.29} },
  "resume template": { g: 40198, comp: 40021, ctr: 125, ctrc: {"US": 106, "UK": 139, "CA": 117, "AU": 104, "DE": 139, "FR": 129}, shares: {"US": 16.07, "UK": 2.77, "CA": 6.08, "AU": 1.89, "DE": 0.9, "FR": 0.41, "IN": 8.12} },
  "scavenger hunt": { g: 2398, comp: 38427, ctr: 105, ctrc: {"IN": 80}, shares: {"US": 47.4, "CA": 5.6, "IN": 1.04} },
  "sewing pattern": { g: 33784, comp: 5592315, ctr: 117, ctrc: {"US": 125, "UK": 117, "CA": 92, "AU": 85, "DE": 79, "FR": 112, "IN": 135}, shares: {"US": 26.65, "UK": 6.4, "CA": 5.98, "AU": 7.49, "DE": 0.8, "FR": 1.38, "IN": 1.34} },
  "shopify theme": { g: 20840, comp: 7770, ctr: 123, ctrc: {"US": 121, "UK": 108, "CA": 57, "AU": 94, "DE": 122, "FR": 127}, shares: {"US": 18.46, "UK": 2.52, "CA": 0.17, "AU": 0.5, "DE": 2.58, "FR": 3.04} },
  "sleep tracker": { g: 1209, comp: 9453, ctr: 98, ctrc: {"UK": 94, "FR": 80, "IN": 88}, shares: {"US": 12.82, "UK": 5.54, "CA": 1.65, "AU": 1.65, "DE": 1.65, "FR": 2.07, "IN": 11.41} },
  "social media planner": { g: 6655, comp: 29554, ctr: 96, ctrc: {"AU": 39, "DE": 69, "IN": 76}, shares: {"US": 19.7, "UK": 0.71, "CA": 6.4, "AU": 0.77, "DE": 0.44, "IN": 2.42} },
  "subscription tracker": { g: 1563, comp: 2436, ctr: 76, ctrc: {"US": 100, "UK": 81, "CA": 80, "IN": 27}, shares: {"US": 40.82, "UK": 5.05, "CA": 1.6, "AU": 1.28, "DE": 1.34, "FR": 1.28, "IN": 4.8} },
  "tags": { g: 1095, comp: 281506, ctr: 95, ctrc: {}, shares: {"US": 61.8, "UK": 5.0, "CA": 1.5, "AU": 1.83} },
  "teacher planner": { g: 5798, comp: 74855, ctr: 105, ctrc: {"US": 110, "UK": 113, "CA": 94, "DE": 95, "FR": 100, "IN": 109}, shares: {"US": 26.65, "UK": 10.66, "CA": 4.97, "DE": 0.36, "FR": 0.57, "IN": 1.0} },
  "travel itinerary": { g: 6038, comp: 24145, ctr: 103, ctrc: {"US": 121, "UK": 67, "AU": 74, "DE": 80, "FR": 137}, shares: {"US": 29.88, "UK": 2.42, "CA": 4.21, "AU": 2.14, "DE": 0.41, "FR": 6.28} },
  "twitch overlay": { g: 40198, comp: 89320, ctr: 120, ctrc: {"US": 123, "DE": 128, "FR": 123}, shares: {"US": 33.26, "UK": 8.5, "AU": 1.05, "DE": 9.73, "FR": 10.87} },
  "vision board kit": { g: 1233, comp: 6043, ctr: 76, ctrc: {"US": 99, "UK": 104, "CA": 69}, shares: {"US": 42.58, "UK": 7.46, "CA": 2.35, "DE": 1.7, "FR": 1.62, "IN": 1.62} },
  "wall art": { g: 305316, comp: 19526108, ctr: 126, ctrc: {"US": 122, "UK": 118, "CA": 108, "AU": 106, "DE": 117, "FR": 123, "IN": 131}, shares: {"US": 18.78, "UK": 5.33, "CA": 3.32, "AU": 1.87, "DE": 2.31, "FR": 1.4, "IN": 5.71} },
  "website template": { g: 18186, comp: 69204, ctr: 110, ctrc: {}, shares: {"US": 16.0, "UK": 3.1} },
  "wedding invitation": { g: 65788, comp: 835188, ctr: 113, ctrc: {"US": 111, "CA": 108, "AU": 100, "DE": 87, "FR": 126}, shares: {"US": 14.41, "UK": 5.97, "CA": 3.58, "AU": 2.28, "DE": 0.75, "FR": 0.46} },
  "wedding seating chart": { g: 7141, comp: 39805, ctr: 95, ctrc: {"UK": 88, "DE": 68}, shares: {"US": 57.1, "UK": 4.03, "CA": 16.8, "AU": 4.6, "DE": 0.53, "FR": 0.28, "IN": 0.7} },
  "wedding thank you card": { g: 88, comp: 3037, ctr: null, ctrc: {}, shares: {} },
  "wedding vows booklet": { g: 20, comp: 2290, ctr: 100, ctrc: {}, shares: {"US": 23.1} },
  "wedding website template": { g: 10506, comp: 9039, ctr: 122, ctrc: {"UK": 71, "CA": 73, "DE": 117}, shares: {"US": 5.32, "UK": 2.38, "CA": 1.23, "AU": 0.36, "DE": 0.51, "FR": 0.19} },
  "wedding welcome sign": { g: 21433, comp: 246462, ctr: 115, ctrc: {"US": 106, "UK": 127, "AU": 98, "DE": 82, "FR": 69, "IN": 79}, shares: {"US": 30.43, "UK": 11.54, "AU": 4.22, "DE": 0.37, "FR": 0.14, "IN": 0.48} },
  "youtube thumbnail template": { g: 767, comp: 2398, ctr: 81, ctrc: {"US": 147}, shares: {"US": 16.82, "UK": 2.61} },
}

// Normalize a keyword the same way the calibration keys were normalized:
// lowercase, non-alphanumerics → spaces, collapse whitespace.
export function normalizeKeyword(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Build a normalized lookup index once at module load.
const _index = new Map<string, ErankEntry>()
for (const [k, v] of Object.entries(ERANK_CALIBRATION)) _index.set(normalizeKeyword(k), v)

// Dice bigram similarity for a conservative fuzzy match (handles minor spelling /
// spacing differences like "cross stitch" vs "crossstitch"). Threshold is high to
// avoid matching a genuinely different keyword.
function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  const t = s.replace(/ /g, '')
  for (let i = 0; i < t.length - 1; i++) {
    const bg = t.slice(i, i + 2)
    m.set(bg, (m.get(bg) ?? 0) + 1)
  }
  return m
}
function dice(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const [bg, ca] of A) inter += Math.min(ca, B.get(bg) ?? 0)
  return (2 * inter) / (A.size + B.size)
}

/**
 * Look up eRank calibration for a keyword. Exact normalized match first, then a
 * conservative fuzzy match (Dice ≥ 0.9). Returns null when the keyword isn't in the
 * captured set — callers then fall back to the modelled estimate.
 */
export function lookupErank(keyword: string): ErankEntry | null {
  if (!keyword) return null
  const key = normalizeKeyword(keyword)
  const exact = _index.get(key)
  if (exact) return exact
  let best: ErankEntry | null = null
  let bestScore = 0.9
  for (const [k, v] of _index) {
    const sc = dice(key, k)
    if (sc > bestScore) { bestScore = sc; best = v }
  }
  return best
}

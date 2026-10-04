/**
 * Everything on the Japan trip page. Booking references and ticket numbers
 * are deliberately left out — the page is public, and a reference plus a
 * surname is enough to open a booking on most airline sites.
 */
export type City = "tokyo" | "kyoto" | "osaka" | "travel";
export type Row = [label: string, text: string];
export type Day = {
  date: string;
  city: City;
  label: string;
  title: string;
  gist: string;
  plan: Row[];
  tips: Row[];
  extras: Row[];
  sleep: string;
};

export const DAYS: Day[] = [
  {
    date: "2026-10-19", city: "travel", label: "Kolkata to Tokyo", title: "Fly to Japan",
    gist: "Air India. 13h 30m, 1 stop in Delhi. Economy, confirmed.",
    plan: [["12:55","AI 1874 departs Kolkata (CCU)"],["Delhi","1 stop in Delhi (DEL), change to AI 358"],["05:55","AI 358 lands at Haneda Terminal 3, Tue 20 Oct (Tokyo time)"]],
    tips: [["Seats","Your booking shows seats only partly selected."],["Meals","Complimentary."]],
    extras: [],
    sleep: "On the plane",
  },
  {
    date: "2026-10-20", city: "tokyo", label: "Tokyo", title: "Tokyo arrival, half-day tour",
    gist: "Tokyo Arrival. Tokyo SIC (shared group) half-day tour.",
    plan: [["05:55","Land at Haneda Terminal 3"],["Transfer","Private airport transfer to the hotel"],["Half day","Imperial Palace Plaza (stroll)"],["","Senso-ji Temple and Nakamise Shopping Street (free time for sightseeing)"],["","Kabukiza (drive-by)"],["","National Diet Building (drive-by)"],["","Tokyo Tower Main Deck (view)"]],
    tips: [["Not confirmed yet","Tour start time."],["Package note","Early check-in is not included."]],
    extras: [["Breakfast","Egg sandwich from the [7-Eleven](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=7-Eleven+Shinjuku+1-chome&destination_place_id=ChIJDwGrFeiMGGARLCeEfqSx1T0&travelmode=walking) next to the hotel, about 50 m, open 24 hours. Useful if you reach the hotel before the tour and breakfast isn't available."],["Asakusa snacks","During the tour's free time at Senso-ji and Nakamise, so these are measured from Senso-ji, not the hotel: melonpan at [Asakusa Kagetsudo](https://www.google.com/maps/dir/?api=1&origin=Senso-ji+Temple+Asakusa&destination=Asakusa+Kagetsudo&destination_place_id=ChIJSTVEQMCOGGARa74pG98OyD0&travelmode=walking) (about 140 m, behind the main hall, 9 am–4:30 pm), fried manju at [Asakusa Kokonoe](https://www.google.com/maps/dir/?api=1&origin=Senso-ji+Temple+Asakusa&destination=Asakusa+Kokonoe&destination_place_id=ChIJVbMuF8GOGGARuUiZ-O7-YWg&travelmode=walking) (about 150 m, 10 am–7 pm), taiyaki at [Naruto Taiyaki Honpo](https://www.google.com/maps/dir/?api=1&origin=Senso-ji+Temple+Asakusa&destination=Naruto+Taiyaki+Honpo+Asakusa&destination_place_id=ChIJkezawMCOGGARf_TceaGcaEQ&travelmode=walking) (about 350 m, near Kaminarimon gate). All are takeaway, so they fit even a short stop."],["Evening","Local walk around Shinjuku-sanchome"],["Dinner (pick one)","Ramen at [Afuri Shinjuku Lumine](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=Afuri+Shinjuku+Lumine&destination_place_id=ChIJq6qq-dCMGGARmyGicupYD2Y&travelmode=walking), about 1.5 km, 20 min walk, open until 10 pm, no booking. Or [Ain Soph Journey](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=Ain+Soph+Journey+Shinjuku&destination_place_id=ChIJyUynodyMGGARfdwk4A8pub8&travelmode=walking), about 650 m, dinner 6–9 pm, book ahead."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-21", city: "tokyo", label: "Tokyo", title: "Mt. Fuji and Hakone",
    gist: "Tokyo SIC: Mt. Fuji and Hakone Tour [Return by Shinkansen] With Lunch (From Shinjuku).",
    plan: [["08:15","Start. Starting point to be announced."],["","Mt. Fuji 5th Station"],["","Hakone Ropeway"],["Lunch","Included"],["Return","By Shinkansen"],["20:00","Ends at Tokyo Station"]],
    tips: [["Not confirmed yet","Starting point."]],
    extras: [["Dinner","Ramen at [T's Tantan](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=T%27s+Tantan+Tokyo+Station&destination_place_id=ChIJtTLL9fuLGGARm6IP54k3xn4&travelmode=transit), inside Tokyo Station where the tour ends at 20:00, open until 10 pm."],["Back","Then [back to the hotel](https://www.google.com/maps/dir/?api=1&origin=T%27s+Tantan+Tokyo+Station&origin_place_id=ChIJtTLL9fuLGGARm6IP54k3xn4&destination=Citadines+Shinjuku+Tokyo&destination_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&travelmode=transit) by train, about 20–25 min."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-22", city: "tokyo", label: "Tokyo", title: "Tokyo Disneyland",
    gist: "Tokyo – Disney transfer (two way, private). Disneyland entry ticket only, with transfers.",
    plan: [["To","Private transfer to Disneyland"],["All day","Disneyland (entry ticket included)"],["Back","Private transfer to the hotel"]],
    tips: [],
    extras: [["Dinner (pick one)","Curry rice at [CoCo Ichibanya Shinjuku 2-chome](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=CoCo+Ichibanya+Shinjuku+2-chome&destination_place_id=ChIJCSlcwsKMGGARBi3AfgAp8R4&travelmode=walking), about 350 m, 5 min walk, open until 11 pm. Ask for the vegetarian menu. Or Indian at [Asian Dining YUMMY](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=Asian+Dining+YUMMY&destination_place_id=ChIJX_bONw2NGGARbE3K9agTgyk&travelmode=walking), about 1.1 km, open until 11 pm. Both stay open late, so they work whatever time the Disney transfer drops you back."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-23", city: "kyoto", label: "Tokyo to Kyoto", title: "Bullet train to Kyoto",
    gist: "Tokyo to Kyoto by bullet train.",
    plan: [["","Check out from the hotel"],["","Station transfer (private)"],["","Bullet train to Kyoto (tickets included)"],["","Arrive at the Kyoto hotel and check in"]],
    tips: [["Package note","Intercity baggage transfer is not included."]],
    extras: [["Afternoon","After check-in: [teamLab Biovortex Kyoto](https://www.google.com/maps/dir/?api=1&origin=Rihga+Royal+Hotel+Kyoto&origin_place_id=ChIJ2_bqcpUIAWARCxsfbw83nEY&destination=teamLab+Biovortex+Kyoto&destination_place_id=ChIJUW4XawAJAWARO8Dp88_nego&travelmode=walking), about 1.3 km, 17 min walk. Last entry 7:30 pm, plan 2.5–3 hours. Book a timed ticket for after your train arrives (time not confirmed yet)."],["Dinner","Indian at [Dana Pani En](https://www.google.com/maps/dir/?api=1&origin=teamLab+Biovortex+Kyoto&origin_place_id=ChIJUW4XawAJAWARO8Dp88_nego&destination=Dana+Pani+En&destination_place_id=ChIJK48KUVUPAWARc5ccxzhHEPs&travelmode=walking), about 800 m from teamLab (link starts at teamLab), dinner until 9:30 pm. If you finish teamLab late, go straight there."]],
    sleep: "RIHGA Royal Hotel, Kyoto",
  },
  {
    date: "2026-10-24", city: "kyoto", label: "Kyoto", title: "Nara, Fushimi Inari, Arashiyama",
    gist: "Nara, Fushimi Inari Taisha, Arashiyama bus tour.",
    plan: [["","Nara"],["","Fushimi Inari Taisha"],["","Arashiyama"]],
    tips: [],
    extras: [["Dinner","After the bus tour (end time not given): curry rice at [CoCo Ichibanya Hachijo Entrance](https://www.google.com/maps/dir/?api=1&origin=Rihga+Royal+Hotel+Kyoto&origin_place_id=ChIJ2_bqcpUIAWARCxsfbw83nEY&destination=CoCo+Ichibanya+Hachijo+Entrance&destination_place_id=ChIJk8GcG60IAWARmjRXG5ZxYD8&travelmode=walking), about 1 km, 13 min walk, open until midnight. Ask for the vegetarian menu."]],
    sleep: "RIHGA Royal Hotel, Kyoto",
  },
  {
    date: "2026-10-25", city: "osaka", label: "Kyoto to Osaka", title: "Bullet train to Osaka",
    gist: "Kyoto to Osaka by bullet train.",
    plan: [["","Bullet train to Osaka"]],
    tips: [["Package note","Intercity baggage transfer is not included."]],
    extras: [["Evening","One route, in this order. 1) Omurice at [Hokkyokusei Namba](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=Hokkyokusei+Namba&destination_place_id=ChIJ3eR2kGznAGARr0Fl25AeyHA&travelmode=transit) (Takashimaya B1F), 2 stops on the Midosuji line to Namba, about 15 min. Closes 8 pm, so arrive by 7. Vegetarian omurice is reported by reviewers, so ask. 2) Walk [to Naruto Taiyaki](https://www.google.com/maps/dir/?api=1&origin=Hokkyokusei+Namba&origin_place_id=ChIJ3eR2kGznAGARr0Fl25AeyHA&destination=Naruto+Taiyaki+Hompo+Osaka&destination_place_id=ChIJ63rK2mrnAGARmhZZX0xYTw0&travelmode=walking) for dessert, about 400 m from Hokkyokusei (link starts there), open until 5 am. 3) Dotonbori neon is right there. Train back from Namba to Hommachi."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-26", city: "osaka", label: "Osaka", title: "Osaka walking tour",
    gist: "Osaka SIC: 1-Day Osaka Walking Tour with Western-style Lunch (round trip from Osaka-Umeda).",
    plan: [["09:40","Start at Hotel Hankyu Respire Osaka"],["","Floating Garden Observatory"],["Lunch","Western-style set menu at Hotel Hankyu Respire Osaka"],["","Board the Aqua Liner"],["","Osaka Castle"],["17:45","Ends at Higashi-Umeda Station"]],
    tips: [["Package note","Vegetarian meals are available and must be requested at the time of booking."]],
    extras: [["Dinner","Okonomiyaki at [CHIBO Dotonbori](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=CHIBO+Dotonbori&destination_place_id=ChIJk9v34BTnAGAR8SL3pWF-3Js&travelmode=transit), open until 11 pm. The tour ends 17:45 at Higashi-Umeda, so take the Midosuji line from Umeda to Namba and walk, roughly 30 min, dinner around 6:30. Ask for no meat, seafood or bonito flakes."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-27", city: "osaka", label: "Osaka", title: "Universal Studios Japan",
    gist: "Osaka – Universal Studios (pick and drop transfer, private). Entry ticket only.",
    plan: [["To","Private pickup to Universal Studios"],["All day","Universal Studios (entry ticket included)"],["Back","Private drop to the hotel"]],
    tips: [],
    extras: [["Dinner","After Universal Studios: curry rice at [CoCo Ichibanya Honmachi 4-chome](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=CoCo+Ichibanya+Honmachi+4-chome&destination_place_id=ChIJ_UBzl-LmAGAROd5c6aTbeDg&travelmode=walking), about 110 m from the hotel, open until 10 pm. Ask for the vegetarian menu."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-28", city: "travel", label: "Osaka to Kolkata", title: "Fly home (Dad to China)",
    gist: "Airport transfer, one way (private). Thai Vietjet, 1 stop in Bangkok. Dhairya and Mom fly home. Dad flies on to China separately.",
    plan: [["","Private transfer to the airport"],["12:00","VZ 567 departs Kansai (KIX)"],["18:10","Lands Bangkok (BKK), 4h 20m layover, change planes"],["22:30","VZ 770 departs Bangkok"],["23:50","Lands Kolkata (CCU)"]],
    tips: [["Itinerary error","The itinerary says transfer from Narita. Your flight leaves from Kansai (KIX)."],["Baggage","Cabin 7 kg and check-in 20 kg per adult."]],
    extras: [],
    sleep: "Home",
  },
];

export const FLIGHTS = [
  {
    route: "Kolkata → Delhi → Tokyo",
    when: "Mon 19 Oct · 12:55 → Tue 20 Oct 05:55",
    lines: [
      "AI 1874 Kolkata → Delhi, then AI 358 → Haneda T3",
      "13h 30m, 1 stop in Delhi",
      "Meals complimentary",
    ],
    who: "Dhairya, Mom (Sweta) and Dad (Dilip)",
  },
  {
    route: "Osaka → Bangkok → Kolkata",
    when: "Wed 28 Oct · 12:00 → 23:50 same night",
    lines: [
      "Thai Vietjet VZ 567 from Kansai (KIX), 4h 20m stop in Bangkok, then VZ 770",
      "20 kg check-in + 7 kg cabin each",
    ],
    who: "Dhairya and Mom. Dad flies on to China separately.",
  },
];

export const HOTELS: { nights: string; name: string; room: string; city: City }[] = [
  { nights: "20, 21, 22 Oct", name: "Citadines Shinjuku, Tokyo", room: "Standard double, breakfast included", city: "tokyo" },
  { nights: "23, 24 Oct", name: "RIHGA Royal Hotel, Kyoto", room: "Standard room, breakfast included", city: "kyoto" },
  { nights: "25, 26, 27 Oct", name: "Osaka View Hotel Honmachi", room: "Standard triple, breakfast included", city: "osaka" },
];

export const TODO = [
  "The last-day airport transfer should go to Kansai (KIX), not Narita.",
  "All 8 hotel nights are booked. The package says 7 nights, but the hotel list covers 8.",
  "The start time and pickup point of the Tokyo half-day tour on 20 Oct.",
  "How long the 20 Oct tour lasts, how long each stop is, and how much free time you get at Senso-ji and Nakamise.",
  "Whether the Tokyo hotel can hold your bags (or give the room early) when you arrive in the morning on 20 Oct.",
  "The starting point for the Mt. Fuji tour on 21 Oct.",
  "Vegetarian lunch on the Osaka tour must be requested at booking.",
  "Dad's ride to the airport on 28 Oct, since he's flying out separately.",
];

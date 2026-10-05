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
    plan: [["12:55", "AI 1874 departs Kolkata (CCU)"], ["Delhi", "1 stop in Delhi (DEL), change to AI 358"], ["05:55", "AI 358 lands at Haneda Terminal 3, Tue 20 Oct (Tokyo time)"]],
    tips: [["Seats", "Your booking shows seats only partly selected."], ["Meals", "Complimentary."]],
    extras: [],
    sleep: "On the plane",
  },
  {
    date: "2026-10-20", city: "tokyo", label: "Tokyo", title: "Tokyo arrival, half-day tour",
    gist: "Tokyo Arrival. Tokyo SIC (shared group) half-day tour.",
    plan: [["05:55", "Land at Haneda Terminal 3"], ["Transfer", "Private airport transfer to the hotel"], ["12:00–13:00", "Room ready by 12–1 pm (earlier if available). Official check-in is 3 pm."], ["14:00", "Tour starts (3–4 hours, ends around 5–6 pm)"], ["", "Imperial Palace Plaza (photo stop)"], ["", "Senso-ji Temple and Nakamise Shopping Street (shopping time, max 1 hour)"], ["", "Kabukiza (photo stop)"], ["", "National Diet Building (photo stop)"], ["", "Tokyo Tower Main Deck (photo stop)"]],
    tips: [["Not confirmed yet", "Tour pickup point."]],
    extras: [["Breakfast", "Egg sandwich from the [7-Eleven](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=7-Eleven+Shinjuku+1-chome&destination_place_id=ChIJDwGrFeiMGGARLCeEfqSx1T0&travelmode=walking) next to the hotel, about 50 m. Good for the morning while you wait for the room."], ["Asakusa (1 hour)", "Browse [Nakamise Street](https://www.google.com/maps/dir/?api=1&origin=Senso-ji+Temple+Asakusa&destination=Nakamise+Shopping+Street&destination_place_id=ChIJPd37MMGOGGARvJ2hfxoiNVE&travelmode=walking) for souvenirs (fans, keychains, chopsticks). Stalls close around 5 pm. Grab the matcha cone at [Chacha Futatsume](https://www.google.com/maps/dir/?api=1&origin=Senso-ji+Temple+Asakusa&destination=Chacha+Futatsume&destination_place_id=ChIJI6WnnQuPGGARdCd19Rz8wbQ&travelmode=walking), about 260 m from Senso-ji near Kaminarimon gate, open until 6 pm, about ¥1,700. Links start at Senso-ji."], ["Evening shopping", "One walking loop after the tour. 1) Shoes at [ABC-Mart Premier Stage](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=ABC-MART+Premier+Stage+Shinjuku+3-chome&destination_place_id=ChIJoy4PhduMGGARKoS1r54Rdro&travelmode=walking) (Nike, Adidas, New Balance, Asics), about 800 m from the hotel, closes 9 pm, so go here first. 2) [Uniqlo flagship, GU and Bic Camera](https://www.google.com/maps/dir/?api=1&origin=ABC-MART+Premier+Stage+Shinjuku+3-chome&origin_place_id=ChIJoy4PhduMGGARKoS1r54Rdro&destination=Bic+Camera+Shinjuku+East+Exit&destination_place_id=ChIJCT-INACNGGARWLBECvtQoNI&travelmode=walking), all in one building, about 300 m from ABC-Mart (link starts there), open until 10 pm."], ["Dinner (pick one)", "Before shopping: [Ain Soph Journey](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=Ain+Soph+Journey+Shinjuku&destination_place_id=ChIJyUynodyMGGARfdwk4A8pub8&travelmode=walking), about 650 m from the hotel, on the way to ABC-Mart, dinner from 6 pm, book ahead. Or after shopping: ramen at [Afuri Shinjuku Lumine](https://www.google.com/maps/dir/?api=1&origin=Bic+Camera+Shinjuku+East+Exit&origin_place_id=ChIJCT-INACNGGARWLBECvtQoNI&destination=Afuri+Shinjuku+Lumine&destination_place_id=ChIJq6qq-dCMGGARmyGicupYD2Y&travelmode=walking), about 400 m from Bic Camera (link starts there), open until 10 pm. Afuri to the hotel is about 1.5 km, 20 min walk or a short taxi."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-21", city: "tokyo", label: "Tokyo", title: "Mt. Fuji and Hakone",
    gist: "Tokyo SIC: Mt. Fuji and Hakone Tour [Return by Shinkansen] With Lunch (From Shinjuku).",
    plan: [["08:15", "Start. Starting point to be announced."], ["", "Mt. Fuji 5th Station"], ["", "Hakone Ropeway"], ["Lunch", "Included"], ["Return", "By Shinkansen"], ["20:00", "Ends at Tokyo Station"]],
    tips: [["Not confirmed yet", "Starting point."]],
    extras: [["Dinner", "Ramen at [T's Tantan](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=T%27s+Tantan+Tokyo+Station&destination_place_id=ChIJtTLL9fuLGGARm6IP54k3xn4&travelmode=transit), inside Tokyo Station where the tour ends at 20:00, open until 10 pm."], ["Back", "Then [back to the hotel](https://www.google.com/maps/dir/?api=1&origin=T%27s+Tantan+Tokyo+Station&origin_place_id=ChIJtTLL9fuLGGARm6IP54k3xn4&destination=Citadines+Shinjuku+Tokyo&destination_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&travelmode=transit) by train, about 20–25 min."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-22", city: "tokyo", label: "Tokyo", title: "Tokyo Disneyland",
    gist: "Tokyo – Disney transfer (two way, private). Disneyland entry ticket only, with transfers.",
    plan: [["To", "Private transfer to Disneyland"], ["All day", "Disneyland (entry ticket included)"], ["Back", "Private transfer to the hotel"]],
    tips: [],
    extras: [["Dinner", "Curry rice at [CoCo Ichibanya Shinjuku 2-chome](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=CoCo+Ichibanya+Shinjuku+2-chome&destination_place_id=ChIJCSlcwsKMGGARBi3AfgAp8R4&travelmode=walking), about 350 m from the hotel, open until 11 pm. Ask for the vegetarian menu."], ["After dinner", "Souvenirs, snacks and funny t-shirts at [Don Quijote Shinjuku Tonanguchi](https://www.google.com/maps/dir/?api=1&origin=CoCo+Ichibanya+Shinjuku+2-chome&origin_place_id=ChIJCSlcwsKMGGARBi3AfgAp8R4&destination=Don+Quijote+Shinjuku+Tonanguchi&destination_place_id=ChIJ18MWiNqMGGARsZO5vEUCONc&travelmode=walking), 8 floors, open 24 hours, about 800 m from CoCo (link starts there). Bring your passport for tax-free. About 1.2 km back to the hotel."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-23", city: "kyoto", label: "Tokyo to Kyoto", title: "Bullet train to Kyoto",
    gist: "Tokyo to Kyoto by bullet train.",
    plan: [["", "Check out from the hotel"], ["", "Station transfer (private)"], ["", "Bullet train to Kyoto (tickets included)"], ["", "Arrive at the Kyoto hotel and check in"]],
    tips: [["Package note", "Intercity baggage transfer is not included."]],
    extras: [["Afternoon", "After check-in: [teamLab Biovortex Kyoto](https://www.google.com/maps/dir/?api=1&origin=Rihga+Royal+Hotel+Kyoto&origin_place_id=ChIJ2_bqcpUIAWARCxsfbw83nEY&destination=teamLab+Biovortex+Kyoto&destination_place_id=ChIJUW4XawAJAWARO8Dp88_nego&travelmode=walking), about 1.3 km, 17 min walk. Last entry 7:30 pm, plan 2.5–3 hours. Book a timed ticket for after your train arrives (time not confirmed yet)."], ["Dinner", "Indian at [Dana Pani En](https://www.google.com/maps/dir/?api=1&origin=teamLab+Biovortex+Kyoto&origin_place_id=ChIJUW4XawAJAWARO8Dp88_nego&destination=Dana+Pani+En&destination_place_id=ChIJK48KUVUPAWARc5ccxzhHEPs&travelmode=walking), about 800 m from teamLab (link starts at teamLab), dinner until 9:30 pm. If you finish teamLab late, go straight there."]],
    sleep: "RIHGA Royal Hotel, Kyoto",
  },
  {
    date: "2026-10-24", city: "kyoto", label: "Kyoto", title: "Nara, Fushimi Inari, Arashiyama",
    gist: "Nara, Fushimi Inari Taisha, Arashiyama bus tour.",
    plan: [["", "Nara"], ["", "Fushimi Inari Taisha"], ["", "Arashiyama"]],
    tips: [],
    extras: [["Dinner", "After the bus tour (end time not given): curry rice at [CoCo Ichibanya Hachijo Entrance](https://www.google.com/maps/dir/?api=1&origin=Rihga+Royal+Hotel+Kyoto&origin_place_id=ChIJ2_bqcpUIAWARCxsfbw83nEY&destination=CoCo+Ichibanya+Hachijo+Entrance&destination_place_id=ChIJk8GcG60IAWARmjRXG5ZxYD8&travelmode=walking), about 1 km from the hotel, open until midnight. Ask for the vegetarian menu."], ["After dinner", "Gadgets, gachapon capsule toys and anime goods at [Yodobashi Camera Kyoto](https://www.google.com/maps/dir/?api=1&origin=CoCo+Ichibanya+Hachijo+Entrance&origin_place_id=ChIJk8GcG60IAWARmjRXG5ZxYD8&destination=Yodobashi+Camera+Multimedia+Kyoto&destination_place_id=ChIJNfpddK8IAWAR21KSO4M57nY&travelmode=walking), open until 10 pm, about 700 m from CoCo through Kyoto Station (link starts there). About 650 m back to the hotel."]],
    sleep: "RIHGA Royal Hotel, Kyoto",
  },
  {
    date: "2026-10-25", city: "osaka", label: "Kyoto to Osaka", title: "Bullet train to Osaka",
    gist: "Kyoto to Osaka by bullet train.",
    plan: [["", "Bullet train to Osaka"]],
    tips: [["Package note", "Intercity baggage transfer is not included."]],
    extras: [["Shopping afternoon", "One route, in this order, after check-in (train time not confirmed; start by 3 pm to fit it all). 1) Shoes at [Asics Shinsaibashi](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=asics+Osaka+Shinsaibashi&destination_place_id=ChIJE0F1JxHnAGARp2gpTuFLvhE&travelmode=walking), about 1.1 km from the hotel, 15 min walk or 1 stop on the Midosuji line, closes 8 pm. 2) Walk the Shinsaibashi-suji covered arcade (Uniqlo, GU, ABC-Mart). 3) Vintage shirts and pants at [JAM Amerikamura](https://www.google.com/maps/dir/?api=1&origin=asics+Osaka+Shinsaibashi&origin_place_id=ChIJE0F1JxHnAGARp2gpTuFLvhE&destination=JAM+Amerika-mura+2nd+Store&destination_place_id=ChIJ_SbkeCDnAGARdgGFBWA0Bc8&travelmode=walking), about 300 m from Asics (link starts there), closes 8 pm."], ["Dinner", "Omurice at [Hokkyokusei Namba](https://www.google.com/maps/dir/?api=1&origin=JAM+Amerika-mura+2nd+Store&origin_place_id=ChIJ_SbkeCDnAGARdgGFBWA0Bc8&destination=Hokkyokusei+Namba&destination_place_id=ChIJ3eR2kGznAGARr0Fl25AeyHA&travelmode=walking), Takashimaya B1F, about 1.1 km from JAM (link starts there), closes 8 pm, so arrive by 7. Ask for the vegetarian omurice."], ["Dessert", "Taiyaki at [Naruto Taiyaki Hompo](https://www.google.com/maps/dir/?api=1&origin=Hokkyokusei+Namba&origin_place_id=ChIJ3eR2kGznAGARr0Fl25AeyHA&destination=Naruto+Taiyaki+Hompo+Osaka&destination_place_id=ChIJ63rK2mrnAGARmhZZX0xYTw0&travelmode=walking), about 400 m from Hokkyokusei, then Dotonbori neon. Train back from Namba to Hommachi."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-26", city: "osaka", label: "Osaka", title: "Osaka walking tour",
    gist: "Osaka SIC: 1-Day Osaka Walking Tour with Western-style Lunch (round trip from Osaka-Umeda).",
    plan: [["09:40", "Start at Hotel Hankyu Respire Osaka"], ["", "Floating Garden Observatory"], ["Lunch", "Western-style set menu at Hotel Hankyu Respire Osaka"], ["", "Board the Aqua Liner"], ["", "Osaka Castle"], ["17:45", "Ends at Higashi-Umeda Station"]],
    tips: [["Package note", "Vegetarian meals are available and must be requested at the time of booking."]],
    extras: [["Collectibles", "The tour ends 17:45 at Higashi-Umeda. Go [to SURUGA-YA Nipponbashi](https://www.google.com/maps/dir/?api=1&origin=Higashi-Umeda+Station&destination=SURUGA-YA+Osaka+Nipponbashi&destination_place_id=ChIJ51SvEWjnAGARPA6EuPAVGDU&travelmode=transit) in Den Den Town (figures, games, cards, manga), about 30 min by train, open until 9 pm. Most other Den Den Town shops close around 7 pm, so Suruga-ya is the safe one."], ["Dinner", "Okonomiyaki at [CHIBO Dotonbori](https://www.google.com/maps/dir/?api=1&origin=SURUGA-YA+Osaka+Nipponbashi&origin_place_id=ChIJ51SvEWjnAGARPA6EuPAVGDU&destination=CHIBO+Dotonbori&destination_place_id=ChIJk9v34BTnAGAR8SL3pWF-3Js&travelmode=walking), about 950 m from Suruga-ya, 13 min walk (link starts there), open until 11 pm. Ask for no meat, seafood or bonito flakes. Train back from Namba to Hommachi."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-27", city: "osaka", label: "Osaka", title: "Universal Studios Japan",
    gist: "Osaka – Universal Studios (pick and drop transfer, private). Entry ticket only.",
    plan: [["To", "Private pickup to Universal Studios"], ["All day", "Universal Studios (entry ticket included)"], ["Back", "Private drop to the hotel"]],
    tips: [],
    extras: [["Dinner", "After Universal Studios: curry rice at [CoCo Ichibanya Honmachi 4-chome](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=CoCo+Ichibanya+Honmachi+4-chome&destination_place_id=ChIJ_UBzl-LmAGAROd5c6aTbeDg&travelmode=walking), about 110 m from the hotel, open until 10 pm. Ask for the vegetarian menu."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-28", city: "travel", label: "Osaka to Kolkata", title: "Fly home (Dad to China)",
    gist: "Airport transfer, one way (private). Thai Vietjet, 1 stop in Bangkok. Dhairya and Sweta fly home. Dad flies on to China separately.",
    plan: [["", "Private transfer to the airport"], ["12:00", "VZ 567 departs Kansai (KIX)"], ["18:10", "Lands Bangkok (BKK), 4h 20m layover, change planes"], ["22:30", "VZ 770 departs Bangkok"], ["23:50", "Lands Kolkata (CCU)"]],
    tips: [["Itinerary error", "The itinerary says transfer from Narita. Your flight leaves from Kansai (KIX)."], ["Baggage", "Cabin 7 kg and check-in 20 kg per adult."]],
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
    who: "Dhairya, Dilip and Sweta Khetan",
  },
  {
    route: "Osaka → Bangkok → Kolkata",
    when: "Wed 28 Oct · 12:00 → 23:50 same night",
    lines: [
      "Thai Vietjet VZ 567 from Kansai (KIX), 4h 20m stop in Bangkok, then VZ 770",
      "20 kg check-in + 7 kg cabin each",
    ],
    who: "Dhairya and Sweta Khetan. Dad flies on to China separately.",
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
  "The pickup point for the Tokyo half-day tour on 20 Oct.",
  "The starting point for the Mt. Fuji tour on 21 Oct.",
  "Vegetarian lunch on the Osaka tour must be requested at booking.",
  "Dad's ride to the airport on 28 Oct, since he's flying out separately.",
];

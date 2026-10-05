/**
 * Everything on the Japan trip page. Booking references and ticket numbers
 * are deliberately left out — the page is public, and a reference plus a
 * surname is enough to open a booking on most airline sites.
 */
export type City = "tokyo" | "kyoto" | "osaka" | "travel";
export type Row = [label: string, text: string];
/** "i" = from the agent's itinerary, "x" = added by Dhairya. An optional note sits under the entry. */
export type Entry = [time: string, text: string, kind: "i" | "x", note?: string];
export type Day = {
  date: string;
  city: City;
  label: string;
  title: string;
  gist: string;
  timeline: Entry[];
  tips: Row[];
  sleep: string;
};

export const DAYS: Day[] = [
  {
    date: "2026-10-19", city: "travel", label: "Kolkata to Tokyo", title: "Fly to Japan",
    gist: "Air India. 13h 30m, 1 stop in Delhi. Economy, confirmed.",
    timeline: [
      ["12:55", "AI 1874 departs Kolkata (CCU)", "i"],
      ["Delhi", "1 stop in Delhi (DEL), change to AI 358", "i"],
      ["05:55", "AI 358 lands at Haneda Terminal 3, Tue 20 Oct (Tokyo time)", "i"],
    ],
    tips: [["Seats", "Your booking shows seats only partly selected."], ["Meals", "Complimentary."]],
    sleep: "On the plane",
  },
  {
    date: "2026-10-20", city: "tokyo", label: "Tokyo", title: "Tokyo arrival, half-day tour",
    gist: "Tokyo Arrival. Tokyo SIC (shared group) half-day tour.",
    timeline: [
      ["05:55", "Land at Haneda Terminal 3", "i"],
      ["Transfer", "Private airport transfer to the hotel", "i"],
      ["Morning", "Egg sandwich from the [7-Eleven](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=7-Eleven+Shinjuku+1-chome&destination_place_id=ChIJDwGrFeiMGGARLCeEfqSx1T0&travelmode=walking) next to the hotel, about 50 m. Good for the morning while you wait for the room.", "x"],
      ["12:00–13:00", "Room ready by 12–1 pm (earlier if available). Official check-in is 3 pm.", "i"],
      ["14:00", "Tour starts (3–4 hours, ends around 5–6 pm)", "i"],
      ["", "Imperial Palace Plaza (photo stop)", "i"],
      ["", "Senso-ji Temple and Nakamise Shopping Street (shopping time, max 1 hour)", "i", "Browse [Nakamise Street](https://www.google.com/maps/dir/?api=1&origin=Senso-ji+Temple+Asakusa&destination=Nakamise+Shopping+Street&destination_place_id=ChIJPd37MMGOGGARvJ2hfxoiNVE&travelmode=walking) for souvenirs (fans, keychains, chopsticks). Stalls close around 5 pm. Grab the matcha cone at [Chacha Futatsume](https://www.google.com/maps/dir/?api=1&origin=Senso-ji+Temple+Asakusa&destination=Chacha+Futatsume&destination_place_id=ChIJI6WnnQuPGGARdCd19Rz8wbQ&travelmode=walking), about 260 m from Senso-ji near Kaminarimon gate, open until 6 pm, about ¥1,700. Links start at Senso-ji."],
      ["", "Kabukiza (photo stop)", "i"],
      ["", "National Diet Building (photo stop)", "i"],
      ["", "Tokyo Tower Main Deck (photo stop)", "i"],
      ["After the tour", "One walking loop after the tour. 1) Shoes at [ABC-Mart Premier Stage](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=ABC-MART+Premier+Stage+Shinjuku+3-chome&destination_place_id=ChIJoy4PhduMGGARKoS1r54Rdro&travelmode=walking) (Nike, Adidas, New Balance, Asics), about 800 m from the hotel, closes 9 pm, so go here first. 2) [Uniqlo flagship, GU and Bic Camera](https://www.google.com/maps/dir/?api=1&origin=ABC-MART+Premier+Stage+Shinjuku+3-chome&origin_place_id=ChIJoy4PhduMGGARKoS1r54Rdro&destination=Bic+Camera+Shinjuku+East+Exit&destination_place_id=ChIJCT-INACNGGARWLBECvtQoNI&travelmode=walking), all in one building, about 300 m from ABC-Mart (link starts there), open until 10 pm.", "x"],
      ["Dinner", "Before shopping: [Ain Soph Journey](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=Ain+Soph+Journey+Shinjuku&destination_place_id=ChIJyUynodyMGGARfdwk4A8pub8&travelmode=walking), about 650 m from the hotel, on the way to ABC-Mart, dinner from 6 pm, book ahead. Or after shopping: ramen at [Afuri Shinjuku Lumine](https://www.google.com/maps/dir/?api=1&origin=Bic+Camera+Shinjuku+East+Exit&origin_place_id=ChIJCT-INACNGGARWLBECvtQoNI&destination=Afuri+Shinjuku+Lumine&destination_place_id=ChIJq6qq-dCMGGARmyGicupYD2Y&travelmode=walking), about 400 m from Bic Camera (link starts there), open until 10 pm. Afuri to the hotel is about 1.5 km, 20 min walk or a short taxi.", "x"],
    ],
    tips: [["Not confirmed yet", "Tour pickup point."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-21", city: "tokyo", label: "Tokyo", title: "Mt. Fuji and Hakone",
    gist: "Tokyo SIC: Mt. Fuji and Hakone Tour [Return by Shinkansen] With Lunch (From Shinjuku).",
    timeline: [
      ["08:15", "Start. Starting point to be announced.", "i"],
      ["", "Mt. Fuji 5th Station", "i"],
      ["", "Hakone Ropeway", "i"],
      ["Lunch", "Included", "i"],
      ["Return", "By Shinkansen", "i"],
      ["20:00", "Ends at Tokyo Station", "i"],
      ["~20:15", "Ramen at [T's Tantan](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=T%27s+Tantan+Tokyo+Station&destination_place_id=ChIJtTLL9fuLGGARm6IP54k3xn4&travelmode=transit), inside Tokyo Station where the tour ends at 20:00, open until 10 pm.", "x"],
      ["~21:15", "Then [back to the hotel](https://www.google.com/maps/dir/?api=1&origin=T%27s+Tantan+Tokyo+Station&origin_place_id=ChIJtTLL9fuLGGARm6IP54k3xn4&destination=Citadines+Shinjuku+Tokyo&destination_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&travelmode=transit) by train, about 20–25 min.", "x"],
    ],
    tips: [["Not confirmed yet", "Starting point."]],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-22", city: "tokyo", label: "Tokyo", title: "Tokyo Disneyland",
    gist: "Tokyo – Disney transfer (two way, private). Disneyland entry ticket only, with transfers.",
    timeline: [
      ["To", "Private transfer to Disneyland", "i"],
      ["All day", "Disneyland (entry ticket included)", "i"],
      ["Back", "Private transfer to the hotel", "i"],
      ["Dinner", "Curry rice at [CoCo Ichibanya Shinjuku 2-chome](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=CoCo+Ichibanya+Shinjuku+2-chome&destination_place_id=ChIJCSlcwsKMGGARBi3AfgAp8R4&travelmode=walking), about 350 m from the hotel, open until 11 pm. Ask for the vegetarian menu.", "x"],
      ["After dinner", "Souvenirs, snacks and funny t-shirts at [Don Quijote Shinjuku Tonanguchi](https://www.google.com/maps/dir/?api=1&origin=CoCo+Ichibanya+Shinjuku+2-chome&origin_place_id=ChIJCSlcwsKMGGARBi3AfgAp8R4&destination=Don+Quijote+Shinjuku+Tonanguchi&destination_place_id=ChIJ18MWiNqMGGARsZO5vEUCONc&travelmode=walking), 8 floors, open 24 hours, about 800 m from CoCo (link starts there). Bring your passport for tax-free. About 1.2 km back to the hotel.", "x"],
    ],
    tips: [],
    sleep: "Citadines Shinjuku, Tokyo",
  },
  {
    date: "2026-10-23", city: "kyoto", label: "Tokyo to Kyoto", title: "Bullet train to Kyoto",
    gist: "Tokyo to Kyoto by bullet train.",
    timeline: [
      ["~8:00", "Check out from the hotel", "i", "Leave bags at the hotel front desk."],
      ["8:30–11:00", "teamLab (Tokyo), 2–3 hours", "i", "[teamLab Borderless](https://www.google.com/maps/dir/?api=1&origin=Citadines+Shinjuku+Tokyo&origin_place_id=ChIJw3B7QeiMGGARMd-dUShWkFU&destination=teamLab+Borderless+Azabudai+Hills&destination_place_id=ChIJQ5Sa1PqJGGARUSaNKKOrMVg&travelmode=transit) (Azabudai Hills), about 4 km from the hotel, ~25 min by metro or ~15–20 min by taxi. Opens 8:30 am. Book the 8:30 entry online in advance. Free lockers inside."],
      ["~11:00", "Taxi to [Takeshita Street, Harajuku](https://www.google.com/maps/dir/?api=1&origin=teamLab+Borderless+Azabudai+Hills&origin_place_id=ChIJQ5Sa1PqJGGARUSaNKKOrMVg&destination=Takeshita+Street+Harajuku&destination_place_id=ChIJlVne8bqMGGARtX5O6ojMvsI&travelmode=driving), about 3.6 km, ~15 min. Each link from here starts at the previous stop.", "x"],
      ["11:30", "Shopping", "i", "[WEGO Harajuku](https://www.google.com/maps/dir/?api=1&origin=Takeshita+Street+Harajuku&origin_place_id=ChIJlVne8bqMGGARtX5O6ojMvsI&destination=WEGO+Harajuku&destination_place_id=ChIJKx4CWaOMGGARoZCHUKj3nnM&travelmode=walking) for cheap fun clothes, then [Kiddy Land](https://www.google.com/maps/dir/?api=1&origin=WEGO+Harajuku&origin_place_id=ChIJKx4CWaOMGGARoZCHUKj3nnM&destination=Kiddy+Land+Harajuku&destination_place_id=ChIJu1uP9aOMGGARiZH5QxSqDm0&travelmode=walking) (about 400 m) for anime and character goods. Pay on each floor."],
      ["12:45 lunch", "[Vegan Bistro Jangara](https://www.google.com/maps/dir/?api=1&origin=Kiddy+Land+Harajuku&origin_place_id=ChIJu1uP9aOMGGARiZH5QxSqDm0&destination=Vegan+Bistro+Jangara+Harajuku&destination_place_id=ChIJaWQvzaiNGGARhBHfiQXyKWs&travelmode=walking), vegan ramen, curry and gyoza, about 400 m, opposite Harajuku Station (2F, above FamilyMart).", "x"],
      ["~13:45", "Train or taxi back to the hotel for bags. Be back by 2:30 pm for the station transfer.", "x"],
      ["~14:30", "Station transfer (private)", "i"],
      ["16:00", "Bullet train to Kyoto (tickets included)", "i"],
      ["Evening", "Arrive at the Kyoto hotel and check in", "i"],
      ["Dinner", "In Kyoto: Indian at [Dana Pani En](https://www.google.com/maps/dir/?api=1&origin=Rihga+Royal+Hotel+Kyoto&origin_place_id=ChIJ2_bqcpUIAWARCxsfbw83nEY&destination=Dana+Pani+En&destination_place_id=ChIJK48KUVUPAWARc5ccxzhHEPs&travelmode=walking), about 1.4 km from the Kyoto hotel, dinner until 9:30 pm.", "x"],
    ],
    tips: [["Package note", "Intercity baggage transfer is not included."]],
    sleep: "RIHGA Royal Hotel, Kyoto",
  },
  {
    date: "2026-10-24", city: "kyoto", label: "Kyoto", title: "Nara, Fushimi Inari, Arashiyama",
    gist: "Nara, Fushimi Inari Taisha, Arashiyama bus tour.",
    timeline: [
      ["08:00–08:30", "Tour starts", "i"],
      ["", "Nara", "i"],
      ["", "Fushimi Inari Taisha", "i"],
      ["", "Arashiyama", "i"],
      ["Dinner", "After the bus tour (end time not given): curry rice at [CoCo Ichibanya Hachijo Entrance](https://www.google.com/maps/dir/?api=1&origin=Rihga+Royal+Hotel+Kyoto&origin_place_id=ChIJ2_bqcpUIAWARCxsfbw83nEY&destination=CoCo+Ichibanya+Hachijo+Entrance&destination_place_id=ChIJk8GcG60IAWARmjRXG5ZxYD8&travelmode=walking), about 1 km from the hotel, open until midnight. Ask for the vegetarian menu.", "x"],
      ["After dinner", "Gadgets, gachapon capsule toys and anime goods at [Yodobashi Camera Kyoto](https://www.google.com/maps/dir/?api=1&origin=CoCo+Ichibanya+Hachijo+Entrance&origin_place_id=ChIJk8GcG60IAWARmjRXG5ZxYD8&destination=Yodobashi+Camera+Multimedia+Kyoto&destination_place_id=ChIJNfpddK8IAWAR21KSO4M57nY&travelmode=walking), open until 10 pm, about 700 m from CoCo through Kyoto Station (link starts there). About 650 m back to the hotel.", "x"],
    ],
    tips: [],
    sleep: "RIHGA Royal Hotel, Kyoto",
  },
  {
    date: "2026-10-25", city: "osaka", label: "Kyoto to Osaka", title: "Bullet train to Osaka",
    gist: "Kyoto to Osaka by bullet train.",
    timeline: [
      ["12:00", "Bullet train to Osaka", "i"],
      ["Afternoon", "In Osaka, after dropping bags at the hotel. Each link starts from the previous stop. Shops close at 8 pm.", "x"],
      ["1. Pokémon Center", "[Pokémon Center Osaka DX](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=Pokemon+Center+Osaka+DX&destination_place_id=ChIJiZ8OQInnAGART2BGEGqySKk&travelmode=walking), Daimaru Shinsaibashi 9F, about 1.25 km from the hotel (16 min walk, or 1 stop on the Midosuji line to Shinsaibashi, which connects to Daimaru). Osaka-only pins, cards and plushies; One Piece shop on the same floor. Open until 8 pm.", "x"],
      ["2. Shoes", "Cross the arcade to [Asics Shinsaibashi](https://www.google.com/maps/dir/?api=1&origin=Pokemon+Center+Osaka+DX&origin_place_id=ChIJiZ8OQInnAGART2BGEGqySKk&destination=asics+Osaka+Shinsaibashi&destination_place_id=ChIJE0F1JxHnAGARp2gpTuFLvhE&travelmode=walking), about 100 m. Open until 8 pm.", "x"],
      ["3. Vintage", "Shirts and pants at [JAM Amerikamura](https://www.google.com/maps/dir/?api=1&origin=asics+Osaka+Shinsaibashi&origin_place_id=ChIJE0F1JxHnAGARp2gpTuFLvhE&destination=JAM+Amerika-mura+2nd+Store&destination_place_id=ChIJ_SbkeCDnAGARdgGFBWA0Bc8&travelmode=walking), about 300 m. Open until 8 pm. If you're running late, skip this one.", "x"],
      ["~6:00 pm dinner", "Omurice at [Hokkyokusei Namba](https://www.google.com/maps/dir/?api=1&origin=JAM+Amerika-mura+2nd+Store&origin_place_id=ChIJ_SbkeCDnAGARdgGFBWA0Bc8&destination=Hokkyokusei+Namba&destination_place_id=ChIJ3eR2kGznAGARr0Fl25AeyHA&travelmode=walking), Takashimaya B1F, about 1.1 km (14 min walk). Closes 8 pm. Ask for the vegetarian omurice.", "x"],
      ["~7:00 pm Dotonbori", "Photo with the Glico sign from [Ebisu Bridge](https://www.google.com/maps/dir/?api=1&origin=Hokkyokusei+Namba&origin_place_id=ChIJ3eR2kGznAGARr0Fl25AeyHA&destination=Ebisu+Bridge&destination_place_id=ChIJdyYZhBPnAGARPF9WeVTYbZM&travelmode=walking) (about 500 m). Then the [Tombori River Cruise](https://www.google.com/maps/dir/?api=1&origin=Ebisu+Bridge&origin_place_id=ChIJdyYZhBPnAGARPF9WeVTYbZM&destination=Tombori+River+Cruise&destination_place_id=ChIJ2ySFjBTnAGAR3ngfXW-dwaU&travelmode=walking) from the pier next to the bridge: 20 min ride under the neon, about ¥2,000, last boats around 9 pm. Then the lantern lane [Hozenji Yokocho](https://www.google.com/maps/dir/?api=1&origin=Tombori+River+Cruise&origin_place_id=ChIJ2ySFjBTnAGAR3ngfXW-dwaU&destination=Hozenji+Yokocho&destination_place_id=ChIJY4ZQxRTnAGAR0mjfWQwO7ho&travelmode=walking) (about 100 m) and taiyaki at [Naruto Taiyaki](https://www.google.com/maps/dir/?api=1&origin=Hozenji+Yokocho&origin_place_id=ChIJY4ZQxRTnAGAR0mjfWQwO7ho&destination=Naruto+Taiyaki+Hompo+Osaka&destination_place_id=ChIJ63rK2mrnAGARmhZZX0xYTw0&travelmode=walking) (about 200 m).", "x"],
      ["Back", "Namba Station is about 400 m away. Midosuji line 2 stops to Hommachi.", "x"],
    ],
    tips: [["Package note", "Intercity baggage transfer is not included."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-26", city: "osaka", label: "Osaka", title: "Osaka walking tour",
    gist: "Osaka SIC: 1-Day Osaka Walking Tour with Western-style Lunch (round trip from Osaka-Umeda).",
    timeline: [
      ["09:40", "Start at Hotel Hankyu Respire Osaka", "i"],
      ["", "Floating Garden Observatory", "i"],
      ["Lunch", "Western-style set menu at Hotel Hankyu Respire Osaka", "i"],
      ["", "Board the Aqua Liner", "i"],
      ["", "Osaka Castle", "i"],
      ["17:45", "Ends at Higashi-Umeda Station", "i"],
      ["~18:15", "The tour ends 17:45 at Higashi-Umeda. Go [to SURUGA-YA Nipponbashi](https://www.google.com/maps/dir/?api=1&origin=Higashi-Umeda+Station&destination=SURUGA-YA+Osaka+Nipponbashi&destination_place_id=ChIJ51SvEWjnAGARPA6EuPAVGDU&travelmode=transit) in Den Den Town (figures, games, cards, manga), about 30 min by train, open until 9 pm. Most other Den Den Town shops close around 7 pm, so Suruga-ya is the safe one.", "x"],
      ["~19:30 dinner", "Okonomiyaki at [CHIBO Dotonbori](https://www.google.com/maps/dir/?api=1&origin=SURUGA-YA+Osaka+Nipponbashi&origin_place_id=ChIJ51SvEWjnAGARPA6EuPAVGDU&destination=CHIBO+Dotonbori&destination_place_id=ChIJk9v34BTnAGAR8SL3pWF-3Js&travelmode=walking), about 950 m from Suruga-ya, 13 min walk (link starts there), open until 11 pm. Ask for no meat, seafood or bonito flakes. Train back from Namba to Hommachi.", "x"],
    ],
    tips: [["Package note", "Vegetarian meals are available and must be requested at the time of booking."]],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-27", city: "osaka", label: "Osaka", title: "Universal Studios Japan",
    gist: "Osaka – Universal Studios (pick and drop transfer, private). Entry ticket only.",
    timeline: [
      ["To", "Private pickup to Universal Studios", "i"],
      ["All day", "Universal Studios (entry ticket included)", "i"],
      ["Back", "Private drop to the hotel", "i"],
      ["Dinner", "After Universal Studios: [Paprika Shokudo Vegan](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=Paprika+Shokudo+Vegan&destination_place_id=ChIJ72nbqATnAGAR8GMxZxz0qNw&travelmode=walking), fully vegan (burgers, gyoza, set meals), about 1 km from the hotel, 12 min walk. Tuesday dinner 5:30–9 pm. If you're back late or too tired: [CoCo Ichibanya](https://www.google.com/maps/dir/?api=1&origin=Osaka+View+Hotel+Honmachi&origin_place_id=ChIJDYCo9OLmAGARHahlNEJ5nhQ&destination=CoCo+Ichibanya+Honmachi+4-chome&destination_place_id=ChIJ_UBzl-LmAGAROd5c6aTbeDg&travelmode=walking) across the street, open until 10 pm.", "x"],
    ],
    tips: [],
    sleep: "Osaka View Hotel Honmachi",
  },
  {
    date: "2026-10-28", city: "travel", label: "Osaka to Kolkata", title: "Fly home (Dad to China)",
    gist: "Airport transfer, one way (private). Thai Vietjet, 1 stop in Bangkok. Dhairya and Sweta fly home. Dad flies on to China separately.",
    timeline: [
      ["", "Private transfer to the airport", "i"],
      ["12:00", "VZ 567 departs Kansai (KIX)", "i"],
      ["18:10", "Lands Bangkok (BKK), 4h 20m layover, change planes", "i"],
      ["22:30", "VZ 770 departs Bangkok", "i"],
      ["23:50", "Lands Kolkata (CCU)", "i"],
    ],
    tips: [["Itinerary error", "The itinerary says transfer from Narita. Your flight leaves from Kansai (KIX)."], ["Baggage", "Cabin 7 kg and check-in 20 kg per adult."]],
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

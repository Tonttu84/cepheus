import type { PartialDictionary } from "./types";

// Draft Finnish for ordinary interface texts.
// Every entry is an unreviewed draft to be checked by a Finnish speaker before use.
//
// The following three groups are deliberately omitted (as missing keys) because
// they require a checked source and must NEVER be machine-translated:
// 1. Every text of the crisis path and any phone number or service name for emergency or crisis help.
// 2. The PHQ-9 and the two taps' question wording and answer options (only official clinical translations may be used).
// 3. The camera group (texts describing the camera, face model, or what it measures).

export const FI_DICTIONARY: PartialDictionary = {
  // Layout & metadata
  "layout.meta.title": {
    text: "Cepheus — Beyond the Clinic",
    reviewed: false,
  },
  "layout.meta.description": {
    text: "TMS-hoidon jälkeinen kotiseurantasovellus potilaan omahoidon ja klinikan seurannan tueksi.",
    reviewed: false,
  },
  "layout.footer.disclaimer": {
    text: "Vointikyselyn prototyyppi TMS-hoidon jälkeiseen seurantaan. Ei diagnostinen tai lääkinnällinen laite; ei tee hoito- tai uusiutumisen ennusteväitteitä.",
    reviewed: false,
  },
  "layout.footer.privacy": {
    text: "Kameran ja mikrofonin tiedot pysyvät laitteessa; vain johdettuja arvoja tallennetaan.",
    reviewed: false,
  },

  // Primary navigation
  "nav.brand": { text: "Cepheus", reviewed: false },
  "nav.tagline": {
    text: "Beyond the Clinic · TMS-hoidon jälkeinen kotiseuranta",
    reviewed: false,
  },
  "nav.ariaLabel": { text: "Päänavigointi", reviewed: false },
  "nav.overview": { text: "Yleisnäkymä", reviewed: false },
  "nav.checkIn": { text: "Vointikysely", reviewed: false },
  "nav.camera": { text: "Kameratarkistus", reviewed: false },
  "nav.patient": { text: "Potilasnäkymä", reviewed: false },
  "nav.clinic": { text: "Klinikkanäkymä", reviewed: false },

  // Badges
  "badge.simulatedData": { text: "Simuloitu data", reviewed: false },
  "badge.defaultSubtitle": {
    text: "8 viikon synteettinen liikerata TMS:n jälkeen",
    reviewed: false,
  },

  // (Crisis help bar keys are omitted from fi.ts per clinical rules)

  // (Shared crisis resources are omitted from fi.ts per clinical rules)

  // Home / Overview page
  "home.badge.subtitle": {
    text: "8 viikon synteettinen liikerata TMS:n jälkeen (päivät 1–56)",
    reviewed: false,
  },
  "home.dataSource.seeded": {
    text: "Tietolähde: PostgreSQL-alustettu osallistuja (sim-post-tms-01)",
    reviewed: false,
  },
  "home.dataSource.memory": {
    text: "Tietolähde: Muistinvarainen deterministinen simulaatio",
    reviewed: false,
  },
  "home.hero.title": {
    text: "Cepheus — Hyvinvoinnin ylläpito TMS-hoidon jälkeen",
    reviewed: false,
  },
  "home.hero.description": {
    text: "Rauhallinen kotiseurantasovellus transkraniaalisen magneettistimulaation (TMS) jälkeisille kuukausille. Cepheus yhdistää kevyen kahdesti viikossa tehtävän vointikyselyn ja älysormuksen unenseurannan kahteen suhteutettuun silmukkaan: yksittäinen pieni askel potilaalle lievässä notkahduksessa, ja laaja-alainen heräte klinikan tueksi pitkittyneessä hiljaisuudessa.",
    reviewed: false,
  },
  "home.hero.participant": {
    text: "Osallistuja: {label}",
    reviewed: false,
  },
  "home.hero.tmsCompleted": {
    text: "TMS-hoitojakso suoritettu: {date}",
    reviewed: false,
  },
  "home.hero.consentedChannels": {
    text: "Aktiiviset suostumuksenvaraiset kanavat: {count}",
    reviewed: false,
  },
  "home.workstreams.ariaLabel": {
    text: "Työkokonaisuuksien osiot",
    reviewed: false,
  },
  "home.workstreams.title": {
    text: "Tutustu osa-alueisiin",
    reviewed: false,
  },
  "home.workstreams.subtitle": {
    text: "Kaikki näkymät käyttävät vain simuloitua dataa",
    reviewed: false,
  },
  "home.card.checkIn.category": {
    text: "Kahdesti viikossa kysely & joka toinen viikko PHQ-9",
    reviewed: false,
  },
  "home.card.checkIn.title": {
    text: "Matalan kynnyksen vointikysely",
    reviewed: false,
  },
  "home.card.checkIn.description": {
    text: 'Neljä 1–5 napautuksen kysymystä kahdesti viikossa, mahdollisuus ohittaa "Ei tänään", vastaamattomat kirjataan puuttuviksi (ei rangaista), ja suora kriisipolku ihmiselle.',
    reviewed: false,
  },
  "home.card.checkIn.link": {
    text: "Avaa vointikysely →",
    reviewed: false,
  },
  "home.card.camera.category": {
    text: "Laitteessa tapahtuva havainnointi",
    reviewed: false,
  },
  "home.card.camera.title": {
    text: "Laitteessa suoritettava kameratarkistus",
    reviewed: false,
  },
  // (home.card.camera.measures.description omitted: camera measurement description)
  "home.card.camera.link": {
    text: "Avaa kameratarkistus →",
    reviewed: false,
  },
  "home.card.patient.category": {
    text: "Sisäinen silmukka · Päivä 29 pieni notkahdus",
    reviewed: false,
  },
  "home.card.patient.title": {
    text: "Potilasnäkymä: Yksi pieni askel tälle päivälle",
    reviewed: false,
  },
  "home.card.patient.description": {
    text: 'Tarjoaa yhden helpon ehdotuksen ("Käy 10 minuutin kävelyllä ulkona") lievän notkahduksen aikana ilman pisteytyksiä, graafeja tai riskiluokitteluja.',
    reviewed: false,
  },
  "home.card.patient.link": {
    text: "Avaa potilasnäkymä →",
    reviewed: false,
  },
  "home.card.clinic.category": {
    text: "Ulkoinen silmukka · Päivä 56 pitkittynyt muutos",
    reviewed: false,
  },
  "home.card.clinic.title": {
    text: "Klinikkanäkymä: Laaja-alainen heräte ja hoitajan yhteydenotto",
    reviewed: false,
  },
  "home.card.clinic.description": {
    text: "Tukee klinikan arviota yhteydenoton tarpeesta näyttämällä laajat elämänalueet ja ajankohdan, sekä toimenpiteet hoitajan puhelun pyytämiseksi tai 5 kerran tehohoitojakson tarjoamiseksi.",
    reviewed: false,
  },
  "home.card.clinic.link": {
    text: "Avaa klinikan yleisnäkymä →",
    reviewed: false,
  },

  // Demo timeline preview
  "demo.timeline.ariaLabel": {
    text: "Interaktiivinen TMS:n jälkeinen esittelyaikajana",
    reviewed: false,
  },
  "demo.timeline.title": {
    text: "8 viikon esittelyaikajana TMS:n jälkeen",
    reviewed: false,
  },
  "demo.timeline.description": {
    text: "Vaihda kolmen hetken välillä nähdäksesi, miten sama aineisto tukee matalan kynnyksen potilastoimia ja klinikan seurantaa.",
    reviewed: false,
  },
  "demo.timeline.tablistAriaLabel": {
    text: "Valitse esittelyhetki",
    reviewed: false,
  },
  "demo.badge.dayWeek": {
    text: "Päivä {dayIndex} · Viikko {weekNumber}",
    reviewed: false,
  },
  "demo.button.well": { text: "Päivä 18 · Tasainen", reviewed: false },
  "demo.button.small_dip": {
    text: "Päivä 29 · Pieni notkahdus",
    reviewed: false,
  },
  "demo.button.sustained_drift": {
    text: "Päivä 56 · Pitkittynyt muutos ja hiljaisuus",
    reviewed: false,
  },
  "demo.moment.well.title": {
    text: "Viikko 3: Vakaa perustaso",
    reviewed: false,
  },
  "demo.moment.well.subtitle": {
    text: "Kahdesti viikossa tehtävä kysely vie ~20 sekuntia, kun uni ja vuorokausirytmi pysyvät lähellä henkilökohtaista perustasoa.",
    reviewed: false,
  },
  "demo.moment.small_dip.title": {
    text: "Viikko 5: Pieni notkahdus",
    reviewed: false,
  },
  "demo.moment.small_dip.subtitle": {
    text: "Yhden kierroksen lievä perustason alitus nostaa esiin yhden matalan kynnyksen ehdotuksen potilaan puhelimeen — ei graafeja tai riskipisteitä.",
    reviewed: false,
  },
  "demo.moment.sustained_drift.title": {
    text: "Viikko 8: Pitkittynyt muutos ja hiljaisuus",
    reviewed: false,
  },
  "demo.moment.sustained_drift.subtitle": {
    text: "Kaksi peräkkäistä madaltunutta kyselyä ja sen jälkeiset vastaamattomat kierrokset sormuksen ollessa käytössä nostavat herätteen hoitajan yhteydenottoa varten.",
    reviewed: false,
  },
  "demo.loop.none": {
    text: "Aktiivinen silmukka: Hiljainen perustaso (ei hälytystä)",
    reviewed: false,
  },
  "demo.loop.patient": {
    text: "Aktiivinen silmukka: Potilaan yhden painikkeen askel",
    reviewed: false,
  },
  "demo.loop.clinic": {
    text: "Aktiivinen silmukka: Klinikan hoitajan yhteydenotto",
    reviewed: false,
  },
  "demo.col1.title": { text: "1 · Kysely & Rytmi", reviewed: false },
  "demo.col1.link": { text: "Avaa kysely", reviewed: false },
  "demo.col2.title": { text: "2 · Potilasnäkymä", reviewed: false },
  "demo.col2.link": { text: "Avaa potilasnäkymä", reviewed: false },
  "demo.col3.title": { text: "3 · Klinikkanäkymä", reviewed: false },
  "demo.col3.link": { text: "Avaa klinikkanäkymä", reviewed: false },
  "demo.latestRound.completed": {
    text: "Suoritettu {date} (Viikko {weekNumber})",
    reviewed: false,
  },
  "demo.latestRound.notToday": {
    text: 'Ohitettu ("Ei tänään") {date}',
    reviewed: false,
  },
  "demo.latestRound.missed": {
    text: "Vastaamaton kysely {date} (kirjattu puuttuvaksi, ei nollapisteitä)",
    reviewed: false,
  },
  "demo.latestRound.none": {
    text: "Ei vielä ajoitettuja kyselyitä",
    reviewed: false,
  },
  "demo.ring.worn": {
    text: "Älysormus käytössä ({wearMinutes} min/pv {date})",
    reviewed: false,
  },
  "demo.ring.notActive": {
    text: "Älysormus ei aktiivinen",
    reviewed: false,
  },
  "demo.checkInNote.well": {
    text: "Kahdesti viikossa tehtävä kysely ja unen säännöllisyys pysyvät henkilökohtaisella perustasolla.",
    reviewed: false,
  },
  "demo.checkInNote.small_dip": {
    text: "Yhden kierroksen lievä notkahdus viikolla 5 kyselyiden pysyessä vastattuina.",
    reviewed: false,
  },
  "demo.checkInNote.sustained_drift": {
    text: "{count} vastaamatonta kyselyä viikolla 8 älysormuksen ollessa aktiivisesti käytössä.",
    reviewed: false,
  },
  "demo.patientSummary.small_dip.headline": {
    text: "Yksi pieni askel tälle päivälle",
    reviewed: false,
  },
  "demo.patientSummary.small_dip.note": {
    text: "Näytetään lievässä notkahduksessa — yksi helppo toimintapainike ilman graafeja, pisteitä tai putkia.",
    reviewed: false,
  },
  "demo.patientSummary.well.headline": {
    text: "Kaikki vakaata — tänään ei kysytä mitään ylimääräistä",
    reviewed: false,
  },
  "demo.patientSummary.well.note": {
    text: "Kun vointi on vakaa, sovellus pysyy rauhallisena eikä pyydä ylimääräistä.",
    reviewed: false,
  },
  "demo.patientSummary.sustained_drift.headline": {
    text: "Lempeä tarkistus & inhimillinen yhteydenotto",
    reviewed: false,
  },
  "demo.patientSummary.sustained_drift.actionTitle": {
    text: "Hoitotiimisi hoitaja voi ottaa sinuun yhteyttä puhelimitse",
    reviewed: false,
  },
  // (demo.patientSummary.sustained_drift.crisis.actionDetail omitted: crisis path)
  "demo.patientSummary.sustained_drift.note": {
    text: "Pitkittyneen muutoksen ja vastaamattomien kierrosten jälkeen tuki siirtyy hoitajan puheluun.",
    reviewed: false,
  },
  "demo.clinicSummary.openFlag": {
    text: "Laaja-alainen seurantamerkintä alkaen {sinceDate}",
    reviewed: false,
  },
  "demo.clinicSummary.noFlag": {
    text: "Klinikan yhteydenottoa ei tarvita",
    reviewed: false,
  },
  "demo.clinicSummary.silenceRingActive": {
    text: "Älysormus pysyy käytössä vastaamattomien kyselyiden aikana.",
    reviewed: false,
  },
  "demo.clinicSummary.flagNote": {
    text: "Tukee klinikan arviota yhteydenoton tarpeesta — nimeää laajat elämänalueet ja alkamisajankohdan, ei raakoja mittaustietoja.",
    reviewed: false,
  },
  "demo.clinicSummary.wellNote": {
    text: "Perustasoviikot muodostavat henkilökohtaisen vertailualueen; herätettä ei nosteta.",
    reviewed: false,
  },
  "demo.clinicSummary.smallDipNote": {
    text: "Yksittäinen lievä notkahdus käsitellään rauhallisesti potilaan puolella ilman klinikan hälytystä.",
    reviewed: false,
  },

  // Check-in page
  "checkIn.badge.subtitle": {
    text: "Kahdesti viikossa kysely & joka toinen viikko PHQ-9",
    reviewed: false,
  },
  "checkIn.badge.timeTag": {
    text: "Vie ~20 sekuntia · Ei vaadi vaivaa huonoinakaan hetkinä",
    reviewed: false,
  },
  "checkIn.header.title": {
    text: "Kahdesti viikossa tehtävä vointikysely & joka toinen viikko PHQ-9",
    reviewed: false,
  },
  "checkIn.header.description": {
    text: 'Suunniteltu kevyeksi TMS-hoidon jälkeen. Voit vastata neljään lyhyeen 1–5 napautuskysymykseen kahdesti viikossa tai valita milloin vain "Ei tänään". Ohitettu tai vastaamatta jäänyt kysely kirjataan vain puuttuvaksi — ei nollapisteitä eikä rangaistuksia.',
    reviewed: false,
  },
  "checkIn.consent.ariaLabel": {
    text: "Aktiivisen suostumuksen läpinäkyvyys",
    reviewed: false,
  },
  "checkIn.consent.title": {
    text: "Mitä tallennetaan & suostumuksen hallinta",
    reviewed: false,
  },
  "checkIn.consent.description": {
    text: "Jokainen seurantakanava kertoo selkeällä kielellä, mitä tallennetaan ja mihin laajaan elämänalueeseen se kuuluu.",
    reviewed: false,
  },
  "checkIn.consent.badge": {
    text: "Suostumus annettu",
    reviewed: false,
  },
  "checkIn.prompts.ariaLabel": {
    text: "Kahdesti viikossa tehtävän kyselyn kysymykset",
    reviewed: false,
  },
  "checkIn.prompts.title": {
    text: "Kahdesti viikossa tehtävän kyselyn kysymykset (4 nopeaa napautusta)",
    reviewed: false,
  },
  "checkIn.prompts.subtitle": {
    text: 'Jos 4 napautusta tuntuu liialta tänään, voit vastata yhteen yleiskysymykseen tai valita "Ei tänään".',
    reviewed: false,
  },
  "checkIn.button.notToday": {
    text: "Ei tänään (ohita ilman seuraamuksia)",
    reviewed: false,
  },
  "checkIn.prompts.itemHeader": {
    text: "Kysymys {number} · {label}",
    reviewed: false,
  },
  "checkIn.prompts.anchorArrow": {
    text: "{lowAnchor} → {highAnchor}",
    reviewed: false,
  },
  // (checkIn.items.* omitted: questionnaire wording and options)
  // (checkIn.crisis.* omitted: crisis path)

  // Patient view page
  "patient.badge.subtitle": {
    text: "Päivä 29 · Viikon 5 lempeä tarkistusnäkymä",
    reviewed: false,
  },
  "patient.header.tag": { text: "Potilasnäkymä", reviewed: false },
  "patient.header.title": {
    text: "Yksi pieni askel tälle päivälle",
    reviewed: false,
  },
  "patient.header.description": {
    text: "Kun vointi tuntuu tavallista raskaammalta, Cepheus tarjoaa yhden yksinkertaisen vaihtoehdon tälle päivälle. Voit kokeilla sitä nyt tai jättää myöhemmäksi — mikä tahansa tuntuu sopivalta.",
    reviewed: false,
  },
  "patient.card.ariaLabel": {
    text: "Tämän päivän matalan kynnyksen askel",
    reviewed: false,
  },
  "patient.card.gentleOptionTag": {
    text: "Kevyt vaihtoehto · ~10 minuuttia",
    reviewed: false,
  },
  "patient.button.accept": {
    text: "Kokeilen tätä tänään",
    reviewed: false,
  },
  "patient.button.skip": { text: "Ei tänään", reviewed: false },
  // (patient.crisis.reassuranceNote omitted: crisis path)
  "patient.suggestions.shortWalk.title": {
    text: "Käy 10 minuutin kävelyllä ulkona",
    reviewed: false,
  },
  "patient.suggestions.shortWalk.detail": {
    text: "Mene ulos kymmeneksi minuutiksi rauhalliseen tahtiin. Ei tavoitteita, ei seurantaa.",
    reviewed: false,
  },
  "patient.suggestions.breathingSpace.title": {
    text: "Pidä 3 minuutin rauhallinen hengitystauko",
    reviewed: false,
  },
  "patient.suggestions.breathingSpace.detail": {
    text: "Istu mukavasti ja anna hengityksen tasaantua kolmen minuutin ajan.",
    reviewed: false,
  },
  "patient.suggestions.brightLight.title": {
    text: "Istu päivänvalossa tai kirkkaan ikkunan ääressä 10 minuuttia",
    reviewed: false,
  },
  "patient.suggestions.brightLight.detail": {
    text: "Vietä kymmenen rauhallista minuuttia luonnonvalossa tai kirkkaan lampun lähellä.",
    reviewed: false,
  },
  "patient.suggestions.socialContact.title": {
    text: "Lähetä lyhyt viesti luotettavalle henkilölle",
    reviewed: false,
  },
  "patient.suggestions.socialContact.detail": {
    text: "Yksinkertainen tervehdys ystävälle tai perheenjäsenelle riittää.",
    reviewed: false,
  },

  // Clinic view page
  "clinic.badge.subtitle": {
    text: "Päivä 56 · Viikon 8 klinikan ulkoisen silmukan näkymä",
    reviewed: false,
  },
  "clinic.header.tag": {
    text: "TMS-hoitotiimin yleisnäkymä",
    reviewed: false,
  },
  "clinic.header.title": {
    text: "TMS-hoidon ulkoisen silmukan klinikkanäkymä",
    reviewed: false,
  },
  "clinic.header.description": {
    text: "Tukee klinikan arviota siitä, milloin ottaa yhteyttä TMS-hoidon käyneeseen osallistujaan. Merkinnät nimeävät vain laajan elämänalueen ja alkamisajankohdan — eivät koskaan raakadataa, tilitapahtumia tai automatisoituja diagnooseja.",
    reviewed: false,
  },
  "clinic.card.ariaLabel": {
    text: "Klinikan laaja-alainen herätekortti",
    reviewed: false,
  },
  "clinic.card.openFlagBadge": {
    text: "Avoin seurantamerkintä · Alkaen {sinceDate}",
    reviewed: false,
  },
  "clinic.card.participantSubtitle": {
    text: "TMS-hoito suoritettu: {tmsCompletedDate} · Seurantapiste: Päivä 56 (Viikko 8)",
    reviewed: false,
  },
  "clinic.card.broadAreaBadge": {
    text: "Vain laaja-alainen yhteenveto",
    reviewed: false,
  },
  "clinic.card.broadAreasHeading": {
    text: "Muuttuneet laajat alueet alkaen {sinceDate}",
    reviewed: false,
  },
  "clinic.card.silenceBoxTitle": {
    text: "Kyselyhiljaisuus puettavan laitteen ollessa käytössä",
    reviewed: false,
  },
  "clinic.card.silenceBoxDescriptionActive": {
    text: "Kaksi peräkkäistä madaltunutta vointikyselyä ja sen jälkeiset vastaamattomat kierrokset viikolla 8 älysormuksen ollessa käytössä (sormus aktiivinen vastaamattomien kierrosten aikana). Vastaamattomat kyselyt toimivat yhteydenoton signaalina, ei nollapisteinä.",
    reviewed: false,
  },
  "clinic.card.silenceBoxDescriptionInactive": {
    text: "Kaksi peräkkäistä madaltunutta vointikyselyä ja sen jälkeiset vastaamattomat kierrokset viikolla 8 älysormuksen ollessa käytössä (sormus ei aktiivinen). Vastaamattomat kyselyt toimivat yhteydenoton signaalina, ei nollapisteinä.",
    reviewed: false,
  },
  "clinic.button.nurseCall": {
    text: "Pyydä hoitajan yhteydenottoa",
    reviewed: false,
  },
  "clinic.button.booster": {
    text: "Tarjoa 5 kerran tehohoitojaksoa",
    reviewed: false,
  },
  "clinic.footer.privacyNote": {
    text: "Yksityisyys & kliiniset rajat: Tämä näkymä paljastaa vain laajat elämänalueet (check_in, sleep, daily_routine) ja muutoksen alkamispäivän. Tarkat kyselymuistiinpanot tai yksittäiset mittaustiedot näytetään vain, jos osallistuja nimenomaisesti päättää jakaa ne klinikan kanssa.",
    reviewed: false,
  },

  // Broad areas
  "broadArea.check_in": {
    text: "Kahdesti viikossa tehtävä kysely",
    reviewed: false,
  },
  "broadArea.sleep": { text: "Unen säännöllisyys", reviewed: false },
  "broadArea.daily_routine": {
    text: "Päivittäinen rutiini",
    reviewed: false,
  },
  "broadArea.activity_outside_home": {
    text: "Aktiivisuus kodin ulkopuolella",
    reviewed: false,
  },
  "broadArea.financial_routine": {
    text: "Taloudellinen rutiini",
    reviewed: false,
  },

  // Measurement method descriptions
  "measurementMethod.check_in.label": {
    text: "Kahdesti viikossa tehtävä vointikysely",
    reviewed: false,
  },
  "measurementMethod.check_in.description": {
    text: "Tallentaa 1–5 napautusvastauksesi kahdesti viikossa ja tiedon siitä, ohitettiinko kysely. Vastaamattomia kierroksia ei koskaan pisteytetä nollaksi.",
    reviewed: false,
  },
  "measurementMethod.phq9.label": {
    text: "Joka toinen viikko tehtävä PHQ-9-kysely",
    reviewed: false,
  },
  // (measurementMethod.crisis.phq9.description omitted: crisis path)
  "measurementMethod.ring_rhythm.label": {
    text: "Älysormuksen uni- ja vuorokausirytmi",
    reviewed: false,
  },
  "measurementMethod.ring_rhythm.description": {
    text: "Tallentaa päivittäiset uniajat, unen säännöllisyyden ja 24 tunnin aktiivisuusrytmin yhteenvedot verrattuna omiin aloitusviikkoihisi.",
    reviewed: false,
  },
  "measurementMethod.camera_expressivity.label": {
    text: "Laitteessa suoritettava kameratarkistus",
    reviewed: false,
  },
  // (measurementMethod.camera.measures.description omitted: camera measurement description)
  "measurementMethod.speech_rate.label": {
    text: "Ääneen luetun puheen ajoitus",
    reviewed: false,
  },
  "measurementMethod.speech_rate.description": {
    text: "Mittaa puhenopeutta ja taukojen pituuksia laitteessasi lyhyen tekstin lukemisen aikana. Ääntä tai sanoja ei tallenneta.",
    reviewed: false,
  },
  "measurementMethod.ambiguous_faces.label": {
    text: "Lyhyt tulkintapeli",
    reviewed: false,
  },
  "measurementMethod.ambiguous_faces.description": {
    text: "Tallentaa vain yhteenvetomääriä ja reaktioaikoja viikoittaisesta tilannepelistä.",
    reviewed: false,
  },
  "measurementMethod.home_routine.label": {
    text: "Kodin päivittäisen rutiinin yhteenveto",
    reviewed: false,
  },
  "measurementMethod.home_routine.description": {
    text: "Tallentaa vain karkeita viikoittaisia rutiinimääriä. Ei koskaan nosta klinikkamerkintää yksinään, ellei myös vointikysely muutu vähintään viikon ajaksi.",
    reviewed: false,
  },
  "measurementMethod.financial_routine.label": {
    text: "Taloudellisen rutiinin yhteenveto (valinnainen)",
    reviewed: false,
  },
  "measurementMethod.financial_routine.description": {
    text: "Tallentaa vain karkeita jaksomääriä, ei koskaan kauppiaita tai tapahtumia. Vaikka jaettu, klinikka näkee vain sanat 'taloudellinen rutiini'.",
    reviewed: false,
  },

  // Camera page & components (omitted: camera group keys require checked translations)
};


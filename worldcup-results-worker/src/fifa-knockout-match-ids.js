/**
 * fifa-knockout-match-ids.js
 *
 * Knockout-stage FIFA IdMatch mappings for the World Cup 2026 schedule.
 * Round-of-32 entries, keyed by canonical match key for the Worker runtime.
 *
 * Validated against FIFA calendar API on 2026-06-28:
 * - 16 unique Round-of-32 IdMatch values confirmed
 * - All UTC kickoff times verified against Hanoi schedule
 * - No TBD participants in fixture mapping
 *
 * ES module. Imported by index.js. No runtime filesystem access.
 */

const KNOCKOUT_MATCH_IDS = {
  // M73: 29 Jun 02:00 ICT = 28 Jun 19:00 UTC
  "South Africa vs Canada": "400021518",

  // M76: 30 Jun 00:00 ICT = 29 Jun 17:00 UTC
  "Brazil vs Japan": "400021516",

  // M74: 30 Jun 03:30 ICT = 29 Jun 20:30 UTC
  "Germany vs Paraguay": "400021513",

  // M75: 30 Jun 08:00 ICT = 30 Jun 01:00 UTC
  "Netherlands vs Morocco": "400021522",

  // M78: 1 Jul 00:00 ICT = 30 Jun 17:00 UTC
  "Ivory Coast vs Norway": "400021514",

  // M77: 1 Jul 04:00 ICT = 30 Jun 21:00 UTC
  "France vs Sweden": "400021523",

  // M79: 1 Jul 08:00 ICT = 1 Jul 01:00 UTC
  "Mexico vs Ecuador": "400021520",

  // M80: 1 Jul 23:00 ICT = 1 Jul 16:00 UTC
  "England vs DR Congo": "400021512",

  // M82: 2 Jul 03:00 ICT = 1 Jul 20:00 UTC
  "Belgium vs Senegal": "400021525",

  // M81: 2 Jul 07:00 ICT = 2 Jul 00:00 UTC
  "USA vs Bosnia & Herzegovina": "400021524",

  // M84: 3 Jul 02:00 ICT = 2 Jul 19:00 UTC
  "Spain vs Austria": "400021519",

  // M83: 3 Jul 06:00 ICT = 2 Jul 23:00 UTC
  "Portugal vs Croatia": "400021526",

  // M85: 3 Jul 10:00 ICT = 3 Jul 03:00 UTC
  "Switzerland vs Algeria": "400021527",

  // M88: 4 Jul 01:00 ICT = 3 Jul 18:00 UTC
  "Australia vs Egypt": "400021515",

  // M86: 4 Jul 05:00 ICT = 3 Jul 22:00 UTC
  "Argentina vs Cape Verde": "400021521",

  // M87: 4 Jul 08:30 ICT = 4 Jul 01:30 UTC
  "Colombia vs Ghana": "400021517"
};

export default KNOCKOUT_MATCH_IDS;
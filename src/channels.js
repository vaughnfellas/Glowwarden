// channels.js - Discord Channel ID Mapping
// Easy copy-paste section - just update IDs here when channels change!

export const CHANNELS = {
    // Text Channels
    CHAMBER_OF_OATHS: '1409822706299306004',
    THE_GRAND_BALLROOM: '1409695442308169921', 
    COUNCIL_OF_BANNERS: '1409841359958966364',
    SCROLLS_OF_JUDGEMENT: '1409841312965853316',
    HALL_OF_RECORDS: '1410345650054234172', // Log channel
    
    // Voice Channels
    RAINBOW_COURT: '1409695442308169924',
    GENERAL_ASSEMBLY: '1409837115348357193',
    RENT_A_WAR_CHAMBER: '1409839975180009525',
    THE_SPORESPIRE: '1409841753019650200',
    
    // Categories
    EMPIRE_HALLS: '1409695442308169920',
    MUSTER_GROUNDS: '1411038741618884638', 
    BATTLEFRONT: '1409836975455862834',
    COUNCIL_CHAMBERS: '1409841176793845761',
  };
  
  // Helper function to get channel name by ID (useful for debugging)
  export function getChannelNameById(id) {
    const entry = Object.entries(CHANNELS).find(([key, value]) => value === id);
    return entry ? entry[0] : 'Unknown';
  }
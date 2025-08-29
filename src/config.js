export const config = {
    // Bot
    TOKEN: process.env.DISCORD_TOKEN,
    GUILD_ID: process.env.GUILD_ID,
    
    // Spore Box
    SPORE_BOX_CHANNEL_ID: process.env.SPORE_BOX_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID || '0',
    DEFAULT_USES: parseInt(process.env.DEFAULT_USES || '4', 10),
    MAX_USES: parseInt(process.env.MAX_USES || '10', 10),
    
    // Temp VCs
    LOBBY_VC_ID: process.env.LOBBY_VC_ID || '1409839975180009525',
    TEMP_VC_CATEGORY_ID: process.env.TEMP_VC_CATEGORY_ID || '1409836975455862834',
    TEMP_VC_NAME_FMT: process.env.TEMP_VC_NAME_FMT || 'War Chamber — {user}',
    TEMP_VC_DELETE_AFTER: Number(process.env.TEMP_VC_DELETE_AFTER || 300),
    TEMP_VC_USER_LIMIT: process.env.TEMP_VC_USER_LIMIT ? parseInt(process.env.TEMP_VC_USER_LIMIT, 10) : null,
    TEMP_HOST_ROLE_ID: process.env.TEMP_HOST_ROLE_ID || '1410629664522764318',
    
    // Sweep
    SWEEP_INTERVAL_SEC: Number(process.env.SWEEP_INTERVAL_SEC || 600),
    
    // Server
    PORT: process.env.PORT || 3000,
  };
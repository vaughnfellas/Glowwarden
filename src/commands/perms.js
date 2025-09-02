// Updated DEFAULT_PERMISSIONS in perms.js
const DEFAULT_PERMISSIONS = {
  channels: {
    [CHANNELS.SPORE_BOX]: {
      name: 'spore-box',
      description: 'Guest landing zone - visitors sign decree here',
      overwrites: [
        {
          id: '@everyone',
          allow: ['ViewChannel', 'ReadMessageHistory'],
          deny: ['SendMessages', 'CreateInstantInvite']
        },
        {
          id: config.STRAY_SPORE_ROLE_ID,
          allow: ['SendMessages', 'UseApplicationCommands', 'AddReactions']
        },
        {
          id: config.TEMP_HOST_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'SendMessages', 'ManageMessages', 'CreateInstantInvite']
        }
      ]
    },
    [CHANNELS.CHAMBER_OF_OATHS]: {
      name: 'chamber-of-oaths',
      description: 'Members complete final oath here',
      overwrites: [
        {
          id: '@everyone',
          deny: ['ViewChannel']
        },
        {
          id: config.ROLE_BASE_MEMBER,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_BASE_OFFICER,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_BASE_VETERAN,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        // Add final roles to chamber access
        {
          id: config.ROLE_FINAL_MYCE,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_GALLIES,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_GCRUS,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_BBEAR,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_RAPO,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_RALLYLT,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'UseApplicationCommands']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'SendMessages', 'ManageMessages']
        }
      ]
    },
    [CHANNELS.SPOREHALL]: {
      name: 'sporehall',
      description: 'Guests wait here, use /vc to join hosts',
      overwrites: [
        {
          id: '@everyone',
          deny: ['ViewChannel']
        },
        {
          id: config.STRAY_SPORE_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages', 'UseApplicationCommands']
        },
        {
          id: config.TEMP_HOST_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages', 'Connect', 'MoveMembers']
        },
        // Add UseApplicationCommands for all final roles
        {
          id: config.ROLE_FINAL_MYCE,
          allow: ['ViewChannel', 'SendMessages', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_GALLIES,
          allow: ['ViewChannel', 'SendMessages', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_GCRUS,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_BBEAR,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_RAPO,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers', 'UseApplicationCommands']
        },
        {
          id: config.ROLE_FINAL_RALLYLT,
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers', 'UseApplicationCommands']
        },
        {
          id: 'BOT',
          allow: ['ViewChannel', 'SendMessages', 'MoveMembers']
        }
      ]
    },
    // Also ensure @everyone has UseApplicationCommands at the guild level
    // This should be set in Discord's Server Settings > Roles > @everyone
    // OR add it as a guild-wide permission check
  },
  
  // Add guild-wide role permissions
  roles: {
    '@everyone': {
      allow: ['UseApplicationCommands'], // This allows slash commands globally
      deny: []
    }
  },

  categories: {
    [CHANNELS.BATTLEFRONT]: {
      overwrites: [
        { id: '@everyone', deny: ['ViewChannel', 'Connect'] },
        { 
          id: config.STRAY_SPORE_ROLE_ID, 
          allow: ['Connect', 'Speak', 'UseVAD', 'UseApplicationCommands'] 
        },
        // Add UseApplicationCommands to temp host role in battlefront
        {
          id: config.TEMP_HOST_ROLE_ID,
          allow: ['ViewChannel', 'Connect', 'UseApplicationCommands', 'CreateInstantInvite']
        },
        { id: 'BOT', allow: ['ViewChannel', 'Connect', 'ManageChannels', 'MoveMembers'] }
      ]
    }
  }
};
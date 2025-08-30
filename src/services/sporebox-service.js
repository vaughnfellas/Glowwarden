function welcomeText(member) {
    const hall = `<#${process.env.SPOREHALL_CHANNEL_ID}>`;
    return [
      `You have wandered into the Empire’s halls as an invited guest.`,
      `Here, you remain a **Stray Spore** — watched, but not yet rooted.\n`,
      `**Sign the decree by placing your mark below:**`,
      `• React (or press the button) if you are LGBTQIA2S+.`,
      `• React (or press the button) if you are an Ally.\n`,
      `Either path grants you the role of **Stray Spore**, unlocking the guest halls.\n`,
      `**Once you are marked, step into ${hall}.**`,
      `There, you will await your host’s summons.`,
      `Should you wish swifter passage once inside ${hall}, use **/vc** and choose your host to be escorted to their War Chamber.\n`,
      `*Beware: Stray Spores wither at dawn.* Those not yet rooted are swept away in the morning cleanse and must seek a new invitation to return.`
    ].join('\n');
  }
  
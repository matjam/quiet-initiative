// quiet-initiative
//
// Downside of this is that I'll need to update it when the dnd5e system updates and if they change this code, but meh.

Hooks.on("init", function() {
  game.settings.register('quiet-initiative', 'quietCombatTrackerInitiativeRolls', {
    name: game.i18n.localize('QUIET_INITIATIVE.OptionL'),
    hint: game.i18n.localize('QUIET_INITIATIVE.OptionD'),
    scope: 'client',     // "world" = sync to db, "client" = local storage
    config: true,       // false if you dont want it to show in module config
    type: Boolean,       // Number, Boolean, String, Object
    default: false,
  });
});

Hooks.on("ready", function() {
  if(!game.modules.get('lib-wrapper')?.active && game.user.isGM) {
    ui.notifications.error("Module Quiet Initiative requires the 'libWrapper' module. Please install and activate it.");
    return;
  }

  if(typeof libWrapper === 'function') {
    console.log("quiet-initiative | found libWrapper.");
  } else {
    console.log("quiet-initiative | unable to find global libWrapper.");
    return;
  }

  libWrapper.register('quiet-initiative', 'game.dnd5e.applications.combat.CombatTracker5e.prototype._onCombatantControl', function (wrapped, event) {
    const btn = event.currentTarget;
    const combatantId = btn.closest(".combatant").dataset.combatantId;
    const combatant = this.viewed.combatants.get(combatantId);
    const rollOptions = game.dnd5e.dice.D20Roll.determineAdvantageMode({event: event, advantage: false, disadvantage: false, fastForward: false});

    rollOptions.isFF = game.settings.get('quiet-initiative', 'quietCombatTrackerInitiativeRolls');;

    if ( (btn.dataset.control === "rollInitiative") && combatant?.actor ) return combatant.actor.rollInitiativeDialog(rollOptions);

    // instead of the super call
    return Object.getPrototypeOf(game.dnd5e.CombatTracker5e).prototype._onCombatantControl.apply(this, event);
  });

  libWrapper.register('quiet-initiative', 'game.dnd5e.documents.Actor5e.prototype.rollInitiativeDialog', async function (wrapped, rollOptions={}) {
    // Create and configure the Initiative roll
    const roll = this.getInitiativeRoll(rollOptions);

    // if we need to FF, then we do it.
    if (!rollOptions.isFF) {
      const choice = await roll.configureDialog({
        defaultRollMode: game.settings.get("core", "rollMode"),
        title: `${game.i18n.localize("DND5E.InitiativeRoll")}: ${this.name}`,
        chooseModifier: false,
        defaultAction: rollOptions.advantageMode ?? dnd5e.dice.D20Roll.ADV_MODE.NORMAL
      });
      if ( choice === null ) return; // Closed dialog
    }

    // Temporarily cache the configured roll and use it to roll initiative for the Actor
    this._cachedInitiativeRoll = roll;
    await this.rollInitiative({createCombatants: true});
    delete this._cachedInitiativeRoll;
  });

  console.log("quiet-initiative | Ready.");
});


# Choose your visitor

## By Joe Belmonte

Production deployed here: [Choose Your Visitor](https://joebelmonte.site/chooseyourvisitor.html)

Dev version deployed here: [Choose Your Visitor Dev](https://joebelmonte.site/dev/cyv/chooseyourvisitor.html)

## Release Notes

### April 8, 2022

- Added a button to dynamically change the visitor ID after page load.
  - Only available when using cobrowse version 5.4+.

### April 3, 2022

- Some enhancements/fixes regarding session pausing/unpausing.
  - The pausing APIs are only available on versions 5.1 or later of cobrowse, so the relevant portions of the code are now wrapped in if statements to make the page backwards compatible with older CB versions. Previously older CB versions crashed the page.
  - Added a `title` hover to the `Pause Session` button when it's disabled explaining why it's disabled.
  - No longer modifying the Glance UI when the session is paused. This was interfering/overwriting localization. There is now a session paused indicator at the top of the page on the visitor side.

### March 27, 2022

- Added an alternative session start button.
  - In addition to starting the session, this button checks to see if the Glance Visitor UI has been loaded. If not, it displays a custom spinner indicating to the visitor that the session is beginning. The spinner is hidden once the session starts.
  - This is meant to address the fact that the built-in Glance `Session Starting...` UI doesn't show up for the first session after page load.

### March 26, 2022

- Added a button to allow the visitor to pause/unpause a session.
  - The visitor can optionally provide a message to be displayed to the agent.
- If the page is refreshed during a paused session, the session will resume in a paused state.
  - This is accomplished by adding the `data-startpaused="1"` attribute to the script tag.
- New sessions will always start in an unpaused state.

### March 15, 2022

- Refactored how the role-based masking demo works.
  - No longer accepts a comma delimited list of roles for the purposes of masking the entire page.
  - There are two sections, labeled `Agent Role "Test1" Content` and `Agent Role "Test2" Content`, that will be masked unless the agents viewing the session are in roles named `role1` and `role2`, respectively.
  - Agents in neither of those roles won't be able to see content in either section.
  - If agents in more than 1 role are viewing the session, both sections will be masked.

### January 29, 2022

- Added an option to set presence to`api` or `off` in the script tag in addition to `on`.
- Changed the label from `Settings` to `Data-Site`.
- Fixed a bug where the script tag was being added twice when `Auto load script` was enabled.

### January 17, 2022

- Added an option to connect to `myglance.net` in addition to `beta.glance.net` and `www.glance.net`.

### January 16, 2022

- Added a checkbox setting for `Auto load script`. If checked, the script will automatically load based on the existing configurations without the user having to click the `Submit` button.

### November 22, 2021

- Once the Cobrowse script has loaded, the version number will appear on the page below the `Title` and to the right of the `About` link.
